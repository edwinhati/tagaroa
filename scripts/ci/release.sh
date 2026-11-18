#!/bin/bash
# Production's Build and Deploy steps (.github/workflows/production.yml).
#
#   bash scripts/ci/release.sh promote <sha>
#     From a checkout of <sha>, a commit on main: copies each deployable's released
#     version (its package.json) from the dev registry to OCIR by digest. That is the
#     image Development built and tested when the version first reached main; nothing
#     is rebuilt. Writes release= (deploy.sh's six lines) and tags= (Changesets' tag
#     names, `@apps/auth@0.1.0`) to $GITHUB_OUTPUT.
#   RELEASE=<six lines> bash scripts/ci/release.sh deploy
#     Deploys on the VM, checks every container there and the two public URLs, and
#     rolls back when a check fails (deploy.sh restores the previous images itself when
#     it fails). After a rollback, writes rollback=done|failed to $GITHUB_OUTPUT.
set -euo pipefail
host=tagaroa@168.107.65.35
output() { printf '%s\n' "$@" >> "${GITHUB_OUTPUT:-/dev/null}"; }

case ${1:-} in
  promote)
    sha=${2:-}
    [[ $sha =~ ^[a-f0-9]{40}$ ]] || { echo "::error::Use a full commit SHA."; exit 1; }
    [[ $(git rev-parse HEAD) == "$sha" ]] || { echo "::error::The checkout is not $sha."; exit 1; }
    git merge-base --is-ancestor "$sha" origin/main || { echo "::error::$sha is not on main."; exit 1; }
    for key in OCIR_NAMESPACE OCIR_USERNAME OCIR_TOKEN REGISTRY_TOKEN; do
      [[ -n ${!key:-} ]] || { echo "::error::$key is not configured."; exit 1; }
    done
    [[ $OCIR_NAMESPACE =~ ^[a-zA-Z0-9_-]+$ ]]
    dev_registry=${DEV_REGISTRY:-registry.engineering.tagaroa.cc}
    printf '%s' "$REGISTRY_TOKEN" | skopeo login "$dev_registry" --username ci --password-stdin
    printf '%s' "$OCIR_TOKEN" | skopeo login sin.ocir.io --username "$OCIR_USERNAME" --password-stdin
    release="RELEASE_SHA=$sha" tags=""
    while read -r name repo dir; do
      package=$(jq -r .name "$dir/package.json")
      version=$(jq -r .version "$dir/package.json")
      # package.json never holds an alpha: those exist only in dev's snapshot builds.
      [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "::error::$name has no released version: $version"; exit 1; }
      src="docker://$dev_registry/tagaroa/$repo:$version"
      dest="sin.ocir.io/$OCIR_NAMESPACE/tagaroa/$repo:$version"
      # An image without arm64 cannot run on the VM.
      arch=$(skopeo inspect --override-os linux --override-arch arm64 --format '{{.Architecture}}' "$src")
      [[ $arch == arm64 ]] || { echo "::error::$name $version has no linux/arm64 image."; exit 1; }
      skopeo copy --all --preserve-digests --retry-times 3 "$src" "docker://$dest"
      want=$(skopeo inspect --raw "$src" | sha256sum)
      got=$(skopeo inspect --raw "docker://$dest" | sha256sum)
      [[ $want == "$got" ]] || { echo "::error::$dest does not match $src after the copy."; exit 1; }
      echo "Promoted $name $version -> $dest"
      release+=$'\n'"$(tr '[:lower:]' '[:upper:]' <<< "$name")_IMAGE=$dest"
      tags+="${tags:+ }$package@$version"
    done <<'DEPLOYABLES'
core core-service servers/core
auth auth apps/auth
admin admin apps/admin
workspace workspace apps/workspace
engineering engineering domains/engineering
DEPLOYABLES
    output "release<<RELEASE_EOF" "$release" RELEASE_EOF "tags=$tags"
    ;;

  deploy)
    : "${RELEASE:?}"
    scp infra/deploy/compose.prod.yml "$host:/home/tagaroa/apps/compose.yml"
    scp infra/deploy/deploy.sh infra/deploy/smoke.sh "$host:/home/tagaroa/apps/"
    if ! ssh "$host" 'sh /home/tagaroa/apps/deploy.sh' <<< "$RELEASE"; then
      echo "::error::deploy.sh failed. It restores the previous images itself; its log above says whether that worked."
      exit 1
    fi
    # Only auth and the API's sign-in routes are public; Pangolin blocks the rest, which
    # NetBird reaches through the private ingress. So every container is checked on the
    # VM, where Pangolin reaches it, and the public pair from here.
    verify() {
      ssh "$host" 'sh /home/tagaroa/apps/smoke.sh tagaroa-prod' || return 1
      local check url expected result
      for check in "auth.tagaroa.cc/ text/html" "tagaroa.cc/api/auth/ok application/json"; do
        read -r url expected <<< "$check"
        result=$(curl --retry 5 --retry-delay 2 --retry-all-errors --fail --silent --show-error \
          -o /dev/null -w '%{http_code} %{content_type}' "https://$url") || return 1
        [[ $result == "200 $expected"* ]] || { echo "$url answered $result"; return 1; }
      done
    }
    verify && exit 0
    echo "::error::The release failed its checks; rolling back to the previous release."
    if ssh "$host" 'sh /home/tagaroa/apps/deploy.sh --rollback'; then
      output rollback=done
    else
      output rollback=failed
      echo "::error::ROLLBACK FAILED."
    fi
    exit 1
    ;;

  *) echo 'usage: release.sh promote <sha> | release.sh deploy' >&2; exit 2 ;;
esac
