# Restore test

Once a week, prod's PostgreSQL cluster is recovered to a chosen moment somewhere
harmless and checked, so "we can restore to a point in time" stays a tested fact. The
result goes to the journal, `restore-test-last.log` and a metric; nobody is notified
(ISSUE-108).

Context: `../NOTES.md`, "Shared Postgres on the OCI VM". Backups themselves already
work (pgBackRest stanza `main` → OCI Object Storage); this workflow only proves restores.

## Trigger

Schedule. Host systemd timer `pgbackrest-restore-test.timer` on the OCI VM, next to the
existing `pgbackrest-housekeeping.timer`: `OnCalendar=Sun *-*-* 02:00:00 UTC` (every
Sunday, before the 03:15 backup), `Persistent=true`. Runs
`/home/docker/postgres/pgbackrest/restore-test.sh` as root. The script and unit files
live in `infra/oci/postgres/`, installed by hand; the VM copy must match.

## Checkpoint

None.

## Steps

1. Pick the newest backup without an error from `pgbackrest info`. It must have
   finished less than 48 hours ago.
2. List the live cluster's databases that accept connections, templates excluded.
3. In the live `postgres` database, create `ops_recovery.markers` if it is missing,
   insert a `<run>-before` marker, read the clock as the recovery target, insert a
   `<run>-after` marker, then switch WAL and wait up to 120 seconds for that WAL file
   to be archived.
4. Create a fresh Docker volume and network named after the run. Never touch the live
   data volume.
5. Run the live `postgres` service's image through `docker compose run --rm --no-deps`,
   with an override that replaces every volume and network and publishes no port. In
   it, `restore-container.sh`:
   - restores the chosen backup to the target time:
     `pgbackrest --set=<backup> restore --type=time --target=<target> --target-action=promote`;
   - starts Postgres on a Unix socket only, with archiving off, and waits up to
     10 minutes for readiness and promotion;
   - opens every database from step 2, and requires the `-before` marker to be there
     and the `-after` marker not to be.
6. On pass, write `pgbackrest_restore_test_last_success_timestamp_seconds` and
   `pgbackrest_restore_test_duration_seconds` to VictoriaMetrics
   (`/api/v1/import/prometheus` on the monitoring network).
7. Pass or fail, remove the container, volume and network, write the run's log to
   `restore-test-last.log` beside the script (mode 0600), and print
   `Restore test passed in <n> seconds` or `Restore test failed at <step> (exit <n>)`
   to the journal.

## Watching the watcher

vmalert rule `TagaroaRestoreTestStale` fires when no successful run has been recorded
for eight days, so a timer that silently stopped shows as firing in vmalert. vmalert
notifies nobody (`-notifier.blackhole`).

## Limits

- The VM has 2 cores and ~8 GB free; the cluster is ~300 MB, so a restore takes minutes.
  If the databases outgrow ~10 GB, move the test to CT 105 or a separate machine.
- Every run adds two rows to `ops_recovery.markers` in the live `postgres` database,
  and nothing removes them.
- This proves the backups restore, not that they survive losing the OCI account: the
  backups live in the same tenancy (see the open gaps in `../NOTES.md`).

## Done when

Running the service by hand passes and records the metric; pointing it at a wrong
stanza fails with the step in `restore-test-last.log`; and
`sh infra/oci/postgres/restore-test.test.sh` and
`sh infra/oci/postgres/restore-container.test.sh` pass.
