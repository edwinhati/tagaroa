# Restore test

Once a month the latest prod backup is restored somewhere harmless and checked, so
"we have backups" stays a tested fact. Silent when it passes; an issue for Rex when it
fails or stops running.

Context: `../NOTES.md`, "Shared Postgres on the OCI VM". Backups themselves already
work (pgBackRest stanza `main` → OCI Object Storage); this workflow only proves restores.

## Trigger

Schedule. Host systemd timer `pgbackrest-restore-test.timer` on the OCI VM, next to the
existing `pgbackrest-housekeeping.timer`:
`OnCalendar=Sun *-*-01..07 02:00:00 UTC` (first Sunday of the month, before the 03:15
backup), `Persistent=true`. Runs `/home/docker/postgres/pgbackrest/restore-test.sh` as root.
Keep the script and unit files in the repo under `infra/oci/postgres/`, installed by hand.

## Checkpoint

None.

## Steps

1. Create a fresh Docker volume `pgrestore-<date>`. Never touch the live data volume.
2. Run the live `postgres` service's image (`tagaroa-postgres-pgbackrest:18-alpine`)
   with the same pgBackRest settings and repository credentials it uses today (reuse the
   service's env/secrets through `docker compose -f /home/docker/postgres/<compose file>
   run --rm --no-deps`, with the temporary volume mounted as the data directory and no
   published port), and run
   `pgbackrest --config=/run/pgbackrest.conf --stanza=main restore --type=immediate --target-action=promote`
   into it. The container must be on no network shared with the live server.
3. Start Postgres on the restored data in the same throwaway container; wait for
   `pg_isready` (timeout 10 minutes).
4. Check, each a pass/fail:
   - Databases `pangolin`, `netbird`, `arcane` and (once prod exists) `tagaroa` are present.
   - In `tagaroa`: the drizzle migrations table has at least one row, and
     `auth."user"` has at least one row.
   - The newest backup's timestamp (`pgbackrest info --output=json`) is under 48 hours old.
5. Remove the container and the volume, pass or fail.
6. On pass, write `pgbackrest_restore_test_last_success_timestamp_seconds <unix time>`
   to VictoriaMetrics (`/api/v1/import/prometheus` on the monitoring network) and log the
   duration to the journal.
7. On any failure, POST `kind: restore-test-failed` to the Ops alert webhook
   (`ops-alerts.md`) with the failing step and the last 50 log lines.

## Watching the watcher

vmalert rule `TagaroaRestoreTestStale`:
`time() - pgbackrest_restore_test_last_success_timestamp_seconds > 40 * 86400` (or the
metric absent for 40 days), labels `team: tagaroa`. It reaches Rex through the same
Alertmanager route as `ops-alerts.md`, so a timer that silently stopped is caught too.

## Limits

- The VM has 2 cores and ~8 GB free; the cluster is ~300 MB, so a restore takes minutes.
  If the databases outgrow ~10 GB, move the test to CT 105 or a separate machine.
- This proves the backups restore, not that they survive losing the OCI account: the
  backups live in the same tenancy (see the open gaps in `../NOTES.md`).

## Done when

Running the service by hand restores, passes all checks, cleans up and records the
metric; deleting the restored `tagaroa` database inside a manual run (or pointing it at
a wrong stanza) produces one Ops alert issue for Rex; and stopping the timer for 40 days
(simulate by deleting the metric) fires `TagaroaRestoreTestStale`.
