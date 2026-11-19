#!/bin/sh
# Builds the Frappe HR image on the host that runs it, from apps.json.
#
#   GIT_USER=oauth2 GIT_TOKEN=<project access token> sh infra/frappe/build.sh <tag>
#
# The image is tagaroa-frappe:<tag>; set FRAPPE_TAG in .env to the same value. apps.json reaches
# the build as a BuildKit secret, so the token is never in a layer or in `docker history`.
set -eu
tag=${1:?usage: build.sh <tag>}
: "${GIT_USER:?any name for a project access token (oauth2), or the username of a deploy token}"
: "${GIT_TOKEN:?a token with Reporter and read_repository on tagaroa/frappe/erp}"
# Where the private apps in apps.json live; the token is added to these URLs only.
PRIVATE_GIT=${PRIVATE_GIT:-https://git.engineering.tagaroa.cc/}

# Frappe itself; ERPNext, HRMS and erp are pinned in apps.json. frappe/build and
# frappe/base must both publish this tag, and they trail Frappe's own releases by a few days.
FRAPPE_VERSION=v16.55.0
# frappe_docker main on 2026-11-13: the Containerfile and the entrypoints come from here.
FRAPPE_DOCKER_REF=0ad1a1152f93b1285104bcd0a8059e036dc5bd3d

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

git init -q "$work/frappe_docker"
git -C "$work/frappe_docker" fetch -q --depth 1 https://github.com/frappe/frappe_docker.git "$FRAPPE_DOCKER_REF"
git -C "$work/frappe_docker" checkout -q FETCH_HEAD

# bench logs every clone command, token included, to logs/bench.log. Delete it in the builder
# stage, before the bench is copied into the image, so it never reaches a layer of the image.
containerfile=$work/frappe_docker/images/layered/Containerfile
sed -i.orig 's#^\(  *\)chmod -R g=u /home/frappe/frappe-bench$#\1rm -f /home/frappe/frappe-bench/logs/bench.log \&\& chmod -R g=u /home/frappe/frappe-bench#' "$containerfile"
grep -q 'rm -f /home/frappe/frappe-bench/logs/bench.log' "$containerfile" || {
  echo "frappe_docker's Containerfile changed; update the bench.log removal in build.sh." >&2
  exit 1
}

# awk reads the token from the environment, keeping it out of every process's arguments.
(
  umask 077
  PRIVATE_GIT=$PRIVATE_GIT awk '{
    i = index($0, ENVIRON["PRIVATE_GIT"])
    if (i) $0 = substr($0, 1, i + 7) ENVIRON["GIT_USER"] ":" ENVIRON["GIT_TOKEN"] "@" substr($0, i + 8)
    print
  }' "$here/apps.json" >"$work/apps.json"
)

# BuildKit leaves secrets out of the cache key, so a changed apps.json would reuse the old bench.
docker build \
  --build-arg FRAPPE_BRANCH="$FRAPPE_VERSION" \
  --build-arg CACHE_BUST="$(cksum <"$here/apps.json")" \
  --secret id=apps_json,src="$work/apps.json" \
  --tag "tagaroa-frappe:$tag" \
  --file "$work/frappe_docker/images/layered/Containerfile" \
  "$work/frappe_docker"

# bench strips each app's .git; make sure the token survived nowhere else. It goes in on stdin,
# and grep prints only the names of files holding it.
if printf '%s\n' "$GIT_TOKEN" | docker run --rm -i --entrypoint grep "tagaroa-frappe:$tag" \
  -rIlF --exclude-dir=node_modules --exclude-dir=env -f /dev/stdin /home/frappe/frappe-bench >&2; then
  docker image rm "tagaroa-frappe:$tag" >/dev/null
  echo "The token is in the files above; removed tagaroa-frappe:$tag. Revoke the token." >&2
  exit 1
fi
echo "Built tagaroa-frappe:$tag"
