#!/bin/bash
set -euo pipefail
umask 077
project=2e3066f3-2cc4-4521-8444-729703e51986
host=tagaroa@168.107.65.35
multica login --token "$MULTICA_TOKEN" >/dev/null
approved=$(multica issue list --status in_progress --project "$project" --limit 100 --output json \
  | jq '[.issues[] | select(.assignee_type=="member" and .assignee_id=="76553844-fcc5-4865-af41-a2bf607ed168") | select(any(.labels[]?; .name=="release"))] | sort_by(.created_at) | .[0] // null')
if [[ "$approved" == null ]]; then echo 'No approved release.'; exit 0; fi
issue=$(jq -r .id <<< "$approved")
sha=$(jq -r '.metadata.sha // empty' <<< "$approved")
log="$RUNNER_TEMP/prod-release.log"
: > "$log"
step=validate
deployed=0
had_prod=0
rollback_failed=0
report_failure() {
  result=$?
  trap - EXIT
  if [[ "$result" == 0 ]]; then exit 0; fi
  if [[ "$deployed" == 1 && "$step" != deploy ]]; then
    ssh "$host" 'sh /home/tagaroa/apps/deploy.sh --rollback' >> "$log" 2>&1 || rollback_failed=1
  elif [[ "$deployed" == 1 && "$result" != 1 ]]; then
    rollback_failed=1
  fi
  log_tail=$(sh infra/release/log-tail.sh "$log")
  body="$RUNNER_TEMP/release-failure.md"
  {
    if [[ "$rollback_failed" == 1 ]]; then echo '**ROLLBACK FAILED.**'; fi
    echo "Release ${sha:0:7} failed at $step."
    if [[ "$deployed" == 0 ]]; then echo 'Deployment did not start; prod unchanged.'
    elif [[ "$had_prod" == 0 ]]; then echo 'No previous production release exists.'
    elif [[ "$rollback_failed" == 0 ]]; then echo 'Previous production release retained or restored.'; fi
    echo
    echo '```text'
    echo "${log_tail:-No diagnostic output.}"
    echo '```'
    echo "$RUN_URL"
  } > "$body"
  multica issue comment add "$issue" --content-file "$body" --allow-external-file >/dev/null
  multica issue status "$issue" blocked >/dev/null
  exit "$result"
}
trap report_failure EXIT
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid approved SHA' >> "$log"; exit 1; }
git merge-base --is-ancestor "$sha" origin/main
curl -fsS --retry 3 -H "Authorization: Bearer $GITHUB_TOKEN" \
  "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/actions/workflows/qa.yml/runs?head_sha=$sha&branch=main&event=push&status=success&per_page=1" \
  | jq -e '.workflow_runs | length > 0' >/dev/null
for key in OCIR_NAMESPACE OCIR_USERNAME OCIR_TOKEN REGISTRY_TOKEN PROD_SSH_KEY PROD_SSH_KNOWN_HOSTS; do
  [[ -n ${!key:-} ]] || { echo "$key is not configured" >> "$log"; exit 1; }
done
[[ "$OCIR_NAMESPACE" =~ ^[a-zA-Z0-9_-]+$ ]]
install -d -m 700 ~/.ssh
printf '%s\n' "$PROD_SSH_KEY" > ~/.ssh/id_ed25519
printf '%s\n' "$PROD_SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
chmod 600 ~/.ssh/id_ed25519 ~/.ssh/known_hosts
had_prod=$(ssh "$host" 'if [ -f /home/tagaroa/apps/.release.env ]; then echo 1; else echo 0; fi')
previous=$(ssh "$host" 'if [ -f /home/tagaroa/apps/.release.env ]; then sed -n "s/^RELEASE_SHA=//p" /home/tagaroa/apps/.release.env; fi')
if [[ "$had_prod" == 1 ]]; then [[ "$previous" =~ ^[a-f0-9]{40}$ ]]; fi
range=${previous:+$previous..}$sha
commit_count=$(git rev-list --count "$range")
from=${previous:-4b825dc642cb6eb9a060e54bf8d69288fbee4904}
migration_count=$(git diff --diff-filter=A --name-only "$from" "$sha" -- 'servers/core/drizzle/*.sql' | wc -l | tr -d ' ')
multica issue comment add "$issue" --content "Releasing ${sha:0:7}. $RUN_URL" >/dev/null
git checkout --quiet --detach "$sha"
# Prod runs each deployable's released version at this sha (its package.json: a
# pending changeset's alpha build never reaches prod), as the image dev deploy built
# when that version first appeared (deploy-dev.yml), copied by digest. Nothing is
# rebuilt at release time.
dev_registry=${DEV_REGISTRY:-registry.engineering.tagaroa.cc}
release="RELEASE_SHA=$sha"
released="" tags=()
step=promote
{
printf '%s' "$REGISTRY_TOKEN" | skopeo login "$dev_registry" --username ci --password-stdin
printf '%s' "$OCIR_TOKEN" | skopeo login sin.ocir.io --username "$OCIR_USERNAME" --password-stdin
while read -r name dir; do
  package=$(jq -r .name "$dir/package.json")
  version=$(jq -r .version "$dir/package.json")
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "$name has no released version at ${sha:0:7}: $version"; exit 1; }
  src="docker://$dev_registry/tagaroa/$name:$version"
  dest="sin.ocir.io/$OCIR_NAMESPACE/tagaroa/$name:$version"
  # An image without arm64 cannot run on the VM.
  arch=$(skopeo inspect --override-os linux --override-arch arm64 --format '{{.Architecture}}' "$src")
  [[ "$arch" == arm64 ]] || { echo "$name $version has no linux/arm64 image"; exit 1; }
  skopeo copy --all --preserve-digests --retry-times 3 "$src" "docker://$dest"
  want=$(skopeo inspect --raw "$src" | sha256sum)
  got=$(skopeo inspect --raw "docker://$dest" | sha256sum)
  [[ "$want" == "$got" ]] || { echo "$dest does not match $src after the copy"; exit 1; }
  echo "Promoted $name $version -> $dest"
  release+=$'\n'"$(tr '[:lower:]' '[:upper:]' <<< "$name")_IMAGE=$dest"
  released+="${released:+, }$name $version"
  tags+=("$package@$version")
done <<'DEPLOYABLES'
core servers/core
auth apps/auth
admin apps/admin
workspace apps/workspace
engineering domains/engineering
DEPLOYABLES
} >> "$log" 2>&1
step=deploy
scp infra/prod/compose.yml infra/prod/deploy.sh "$host:/home/tagaroa/apps/" >> "$log" 2>&1
deployed=1
ssh "$host" 'sh /home/tagaroa/apps/deploy.sh' <<< "$release" >> "$log" 2>&1
step=verify
for domain in auth.tagaroa.cc admin.tagaroa.cc app.tagaroa.cc tagaroa.cc; do
  path=/; expected=text/html
  if [[ "$domain" == tagaroa.cc ]]; then path=/api/health/live; expected=application/json; fi
  result=$(curl --retry 5 --retry-delay 2 --retry-all-errors --fail --silent --show-error \
    -o /dev/null -w '%{http_code} %{content_type}' "https://$domain$path")
  [[ "$result" == "200 $expected"* ]] || { echo "$domain smoke check failed: $result" >> "$log"; exit 1; }
done
curl --retry 5 --retry-all-errors --fail --silent --show-error -o /dev/null https://app.tagaroa.cc/engineering
# Changesets' tag names (`changeset tag`), on the sha that shipped them; a version
# already tagged keeps its first release's tag. Prod is out by now, so this only warns.
push_tags() {
  local new_tags=() tag
  for tag in "${tags[@]}"; do
    git rev-parse -q --verify "refs/tags/$tag" >/dev/null || { git tag "$tag" "$sha" && new_tags+=("refs/tags/$tag"); }
  done
  ((${#new_tags[@]})) || return 0
  git -c "http.extraheader=AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')" \
    push --quiet "${GITHUB_SERVER_URL:-https://github.com}/$GITHUB_REPOSITORY.git" "${new_tags[@]}"
}
push_tags >> "$log" 2>&1 || echo "::warning::Released, but the version tags were not pushed: ${tags[*]}"
step=report
multica issue comment add "$issue" --content "Released ${sha:0:7}: $released. $commit_count commits, $migration_count migrations applied. $RUN_URL" >/dev/null
multica issue status "$issue" 'done' >/dev/null
trap - EXIT
echo "Released ${sha:0:7}"
