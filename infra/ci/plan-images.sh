#!/bin/bash
# Works out, for one commit, each deployable's version and image, and which of
# those images are not in the registry yet. Runs in development.yml's plan job from
# a full install of the repo at that commit, logged in to the registry.
#
# A deployable with a pending changeset gets its next version as an alpha snapshot
# (`changeset version --snapshot alpha`: X.Y.Z-alpha-<sha7>); one without keeps its
# released X.Y.Z. A tag that exists is never built again, so a released version is
# built once, from the commit that set it.
#
#   SHA=<full sha> REGISTRY=<host> bash infra/ci/plan-images.sh
# Writes to $GITHUB_OUTPUT: core= (version to build, or empty), apps= (JSON list
# of {name, dir, path, version} to build) and release= (deploy.sh's six lines).
# The snapshot rewrites package.json files; the job's checkout is thrown away.
set -euo pipefail
: "${SHA:?}" "${REGISTRY:?}" "${GITHUB_OUTPUT:?}"
# Just after a release nothing is pending, and Changesets refuses to snapshot.
if find .changeset -maxdepth 1 -name '*.md' ! -name README.md | grep -q .; then
  bunx changeset version --snapshot alpha >&2
fi

release="RELEASE_SHA=$SHA"
core="" apps="[]"
while read -r name repo dir path; do
  version=$(jq -r .version "$dir/package.json")
  image="$REGISTRY/tagaroa/$repo:$version"
  release+=$'\n'"$(tr '[:lower:]' '[:upper:]' <<< "$name")_IMAGE=$image"
  # Only a registry that says the tag is unknown means "build it": any other
  # failure must not rebuild, and so replace, a released image.
  if out=$(docker manifest inspect "$image" 2>&1); then
    echo "exists: $image" >&2
    continue
  fi
  grep -qiE 'no such manifest|manifest unknown|not found' <<< "$out" \
    || { echo "Cannot tell whether $image exists: $out" >&2; exit 1; }
  echo "build:  $image" >&2
  if [[ $name == core ]]; then
    core=$version
  else
    apps=$(jq -c --arg name "$name" --arg dir "$dir" --arg path "${path#-}" --arg version "$version" \
      '. + [{name: $name, dir: $dir, path: $path, version: $version}]' <<< "$apps")
  fi
done <<'DEPLOYABLES'
core core-service servers/core -
auth auth apps/auth -
admin admin apps/admin -
workspace workspace apps/workspace -
engineering engineering domains/engineering /engineering
DEPLOYABLES

{
  echo "core=$core"
  echo "apps=$apps"
  printf 'release<<RELEASE_EOF\n%s\nRELEASE_EOF\n' "$release"
} >> "$GITHUB_OUTPUT"
