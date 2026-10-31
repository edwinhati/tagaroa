# Ops alerts

When prod breaks (or a dev deploy or restore test fails), an issue lands on Rex's desk
in Multica, he works out why, and hands you a diagnosis. You hear about an outage
from a brief, not from a user.

Context and machine details: `../NOTES.md`.

## Trigger

Event. Four sources, one Multica webhook:

| `kind`                | Sent by                         | When                                                                        |
| --------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `prod-down`           | Alertmanager on the OCI VM      | Tagaroa prod probe failing for 3 minutes, or `PostgreSQLUnavailable` firing |
| `prod-down`           | `release-prod.yml`              | a failed release could not roll back                                        |
| `dev-deploy-failed`   | `deploy-dev.yml`                | a dev deploy failed and dev was rolled back                                 |
| `restore-test-failed` | `restore-test.sh` on the OCI VM | the monthly restore test failed or did not run                              |

## Checkpoint

None before Rex starts. Rex ends by handing the issue to edwinhati with his diagnosis;
that hand-off is the brief. Rex never changes prod.

## The Multica side (one-time)

- New autopilot **"Ops alert"**, create_issue mode, assignee Rex, webhook trigger, like
  "QA failed on main". Its URL goes into the GitHub secret `MULTICA_OPS_WEBHOOK` and into
  Alertmanager's config on the VM (file mode 0600). Verify once that the webhook accepts
  Alertmanager's JSON payload as-is; if it requires a fixed shape, put a tiny relay in
  front (Vector is already on the VM and can reshape and forward HTTP).
- Autopilot instructions for Rex:
  - Read `kind` and the payload first.
  - `prod-down`: diagnose **read-only** over `ssh ubuntu@168.107.65.35`:
    `docker compose -p tagaroa-prod ps`, `docker logs --since 30m` for core and web,
    `curl -s https://tagaroa.cc/api/health/live`, `cat /home/tagaroa/apps/.release.env`
    (what is deployed, and when), `docker ps` health of `postgres` and `pangolin`. Do not
    restart, roll back, edit files or run migrations.
  - `dev-deploy-failed`: open the run URL, find the failing step, reproduce locally if it
    is a code problem, and open a PR with the fix if one is clear; otherwise diagnose.
  - `restore-test-failed`: read the log tail in the payload, then
    `journalctl -u pgbackrest-restore-test --since -2d` on the VM, read-only.
  - End with one comment: what broke, the evidence (log lines), the likely cause, the
    fix you propose (or the PR), and whether users are affected now. Then assign the
    issue to edwinhati in status Todo. Never In Review.

## The VM side (one-time, `/home/docker/monitoring`)

Keep the source of every file below in the repo under `infra/oci/monitoring/`, installed by
hand; the VM copy must match the repo.

- **Probe:** a blackbox-exporter job `tagaroa-prod` (module `http_2xx`, 30 s interval)
  for `https://tagaroa.cc/api/health/live` and `https://app.tagaroa.cc/`. Add it
  where the existing scrape config lives, next to the current blackbox targets.
- **Rule** in `/etc/vmalert/alerts.yml`: `TagaroaProdDown`,
  `probe_success{job="tagaroa-prod"} == 0` for `3m`, labels `team: tagaroa`,
  `severity: critical`. Add `team: tagaroa` to the existing `PostgreSQLUnavailable` rule
  too, since prod depends on it.
- **Alertmanager:** new `prom/alertmanager` container in the monitoring compose stack,
  no host port. Route `team="tagaroa"` to a webhook receiver pointing at the Ops alert
  URL, `group_by: [alertname]`, `group_wait: 1m`, `repeat_interval: 24h`,
  `send_resolved: false`; every other alert to a null receiver, so the existing alerts
  stay silent as they are today. Change vmalert's `-notifier.blackhole` to
  `-notifier.url=http://alertmanager:9093`.

## Payload (GitHub and VM scripts)

`POST $MULTICA_OPS_WEBHOOK`, `Content-Type: application/json`,
`Idempotency-Key: <kind>-<unique run id>`, body
`{"kind": "...", "env": "dev|prod", "sha": "...", "step": "...", "log_tail": "...", "run_url": "..."}`
(omit what does not apply). `infra/ops/ops-alert.sh` sends it; use it rather than hand-built `curl`. `log_tail` is at most 50 lines with secrets scrubbed (never
send `.env` contents).

## Done when

Stopping `tagaroa-prod-web-1` for five minutes produces exactly one Ops alert issue
assigned to Rex, which ends with his diagnosis assigned to you; the other existing
alerts still notify nobody; and a failed dev deploy and a failed restore test each
produce one issue with their log tail.
