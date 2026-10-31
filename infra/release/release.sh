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
  tail_json=$(sh infra/ops/ops-alert.sh --dry-run --kind prod-down --id "$GITHUB_RUN_ID" --log "$log")
  body="$RUNNER_TEMP/release-failure.md"
  {
    if [[ "$rollback_failed" == 1 ]]; then echo '**ROLLBACK FAILED.**'; fi
    echo "Release ${sha:0:7} failed at $step."
    if [[ "$deployed" == 0 ]]; then echo 'Deployment did not start; prod unchanged.'
    elif [[ "$had_prod" == 0 ]]; then echo 'No previous production release exists.'
    elif [[ "$rollback_failed" == 0 ]]; then echo 'Previous production release retained or restored.'; fi
    echo
    echo '```text'
    jq -r '.log_tail // "No diagnostic output."' <<< "$tail_json"
    echo '```'
    echo "$RUN_URL"
  } > "$body"
  multica issue comment add "$issue" --content-file "$body" --allow-external-file >/dev/null
  multica issue status "$issue" blocked >/dev/null
  if [[ "$rollback_failed" == 1 ]]; then
    sh infra/ops/ops-alert.sh --kind prod-down --id "$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" \
      --env prod --sha "$sha" --step "$step" --run-url "$RUN_URL" --log "$log"
  fi
  exit "$result"
}
trap report_failure EXIT
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid approved SHA' >> "$log"; exit 1; }
git merge-base --is-ancestor "$sha" origin/main
curl -fsS --retry 3 -H "Authorization: Bearer $GITHUB_TOKEN" \
  "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/actions/workflows/qa.yml/runs?head_sha=$sha&branch=main&event=push&status=success&per_page=1" \
  | jq -e '.workflow_runs | length > 0' >/dev/null
for key in OCIR_NAMESPACE OCIR_USERNAME OCIR_TOKEN PROD_SSH_KEY PROD_SSH_KNOWN_HOSTS; do
  [[ -n ${!key:-} ]] || { echo "$key is not configured" >> "$log"; exit 1; }
done
[[ "$OCIR_NAMESPACE" =~ ^[a-zA-Z0-9_-]+$ ]]
install -d -m 700 ~/.ssh
printf '%s\n' "$PROD_SSH_KEY" > ~/.ssh/id_ed25519
printf '%s\n' "$PROD_SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
chmod 600 ~/.ssh/id_ed25519 ~/.ssh/known_hosts
had_prod=$(ssh "$host" 'if [ -f /home/tagaroa/apps/.release.env ]; then echo 1; else echo 0; fi')
previous=$(ssh "$host" 'if [ -f /home/tagaroa/apps/.release.env ]; then sed -n "s/^CORE_IMAGE=.*://p" /home/tagaroa/apps/.release.env; fi')
if [[ "$had_prod" == 1 ]]; then [[ "$previous" =~ ^[a-f0-9]{40}$ ]]; fi
range=${previous:+$previous..}$sha
commit_count=$(git rev-list --count "$range")
from=${previous:-4b825dc642cb6eb9a060e54bf8d69288fbee4904}
migration_count=$(git diff --diff-filter=A --name-only "$from" "$sha" -- 'servers/core/drizzle/*.sql' | wc -l | tr -d ' ')
multica issue comment add "$issue" --content "Releasing ${sha:0:7}. $RUN_URL" >/dev/null
git checkout --quiet --detach "$sha"
core="sin.ocir.io/$OCIR_NAMESPACE/tagaroa/core:$sha"
web="sin.ocir.io/$OCIR_NAMESPACE/tagaroa/web:$sha"
step=build
{
printf '%s' "$OCIR_TOKEN" | docker login sin.ocir.io --username "$OCIR_USERNAME" --password-stdin
docker buildx build --platform linux/arm64 --push -f servers/core/Dockerfile -t "$core" .
docker buildx build --platform linux/arm64 --push -f infra/web/Dockerfile -t "$web" \
  --build-arg VITE_AUTH_BASE_URL=https://api.tagaroa.cc \
  --build-arg VITE_AUTH_URL=https://auth.tagaroa.cc \
  --build-arg VITE_WORKSPACE_URL=https://app.tagaroa.cc \
  --build-arg VITE_ADMIN_URL=https://admin.tagaroa.cc \
  --build-arg VITE_POST_SIGNIN_URL=https://app.tagaroa.cc \
  --build-arg VITE_TRUSTED_REDIRECT_ORIGINS=https://app.tagaroa.cc,https://admin.tagaroa.cc .
} >> "$log" 2>&1
step=deploy
scp infra/prod/compose.yml infra/prod/deploy.sh "$host:/home/tagaroa/apps/" >> "$log" 2>&1
deployed=1
# The image refs contain only a fixed registry, validated namespace and hex SHA.
# shellcheck disable=SC2029
ssh "$host" "sh /home/tagaroa/apps/deploy.sh '$core' '$web'" >> "$log" 2>&1
step=verify
for domain in auth admin app api; do
  path=/; expected=text/html
  if [[ "$domain" == api ]]; then path=/api/health/live; expected=application/json; fi
  result=$(curl --retry 5 --retry-delay 2 --retry-all-errors --fail --silent --show-error \
    -o /dev/null -w '%{http_code} %{content_type}' "https://$domain.tagaroa.cc$path")
  [[ "$result" == "200 $expected"* ]] || { echo "$domain smoke check failed: $result" >> "$log"; exit 1; }
done
curl --retry 5 --retry-all-errors --fail --silent --show-error -o /dev/null https://app.tagaroa.cc/engineering
if [[ "$had_prod" == 0 ]]; then
  step=enable-prod-alerts
  ssh "$host" 'docker exec alertmanager amtool --alertmanager.url=http://localhost:9093 silence query --output=json alertname=TagaroaProdDown' \
    > "$RUNNER_TEMP/prod-silences.json"
  while read -r silence; do
    [[ "$silence" =~ ^[a-f0-9-]{36}$ ]]
    # Validated Alertmanager UUID; intentional expansion on the runner.
    # shellcheck disable=SC2029
    ssh "$host" "docker exec alertmanager amtool --alertmanager.url=http://localhost:9093 silence expire '$silence'" >> "$log" 2>&1
  done < <(jq -r '.[] | select(.comment | contains("ISSUE-10")) | .id' "$RUNNER_TEMP/prod-silences.json")
fi
step=report
multica issue comment add "$issue" --content "Released ${sha:0:7}. $commit_count commits, $migration_count migrations applied. $RUN_URL" >/dev/null
multica issue status "$issue" 'done' >/dev/null
trap - EXIT
echo "Released ${sha:0:7}"
