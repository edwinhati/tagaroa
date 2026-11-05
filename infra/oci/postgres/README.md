# Restore verification

For the proposed encryption/offsite migration and its restore compatibility
gates, see [backup hardening](../../../docs/ops/workflows/backup-hardening.md).
That proposal is documentation only; the runner below remains unchanged.

Run on the OCI PostgreSQL host as root. The compose override replaces every
volume and network from the live service. The restore uses a fresh data volume,
a dedicated network with repository egress, and a Unix socket with no published
port. Cleanup runs on success and failure. A host lock prevents overlapping runs.

Install `restore-test.sh`, `restore-container.sh`, and `infra/ops/ops-alert.sh`
in `/home/docker/postgres/pgbackrest/`, alongside the existing config template.
Install the service and timer in `/etc/systemd/system/`, then:

```sh
systemctl daemon-reload
systemctl start pgbackrest-restore-test.service
systemctl enable --now pgbackrest-restore-test.timer
systemctl list-timers pgbackrest-restore-test.timer
```

The script reads the existing Alertmanager webhook file as root and reuses the
PostgreSQL service's repository credentials. Logs sent to Multica use the shared
secret scrubber. The service has a 30-minute timeout; readiness has a 10-minute
timeout. Both paths clean up scratch containers, volumes and networks.

To verify alert delivery without touching a backup or live database:

```sh
RESTORE_TEST_STANZA=verification-missing-stanza bash /home/docker/postgres/pgbackrest/restore-test.sh
```

This intentionally fails and opens one Ops alert issue. Inspect its payload and
close it as a test. `sh infra/oci/postgres/restore-test.test.sh` checks
locally, with Docker stubbed, that failure alerts carry each phase's error. A successful run records a timestamp in VictoriaMetrics;
`last_over_time(pgbackrest_restore_test_last_success_timestamp_seconds[41d])`
reads it between monthly runs. The alert uses a range query so a single imported
sample remains visible for the full monitoring window. Apply the updated
`infra/oci/monitoring/alerts.yml` and restart vmalert after installation.

Tagaroa database presence is required once the live database exists. Migration
and user rows are required once either the live `auth` or `drizzle` schema exists;
an empty provisioned database has no application data to verify yet. Partial
initialization still requires both tables and nonempty migration/user data.
Before provisioning, the test checks Pangolin, NetBird and Arcane.

The restore stops at the selected backup's earliest consistent point
(`--type=immediate`), not the current live state. A database created after that
backup must still fail the presence check. After provisioning or initializing
Tagaroa, take a fresh backup and verify it before relying on that backup for
recovery. A successful backup alone does not prove the restore check will pass.
Install both scripts together; an older host script defaults to strict contents
checks. Run the local regression checks without Docker or repository access:

```sh
sh infra/oci/postgres/restore-test.test.sh
sh infra/oci/postgres/restore-container.test.sh
```

This verifies restore capability in the current OCI tenancy; separate-account
disaster recovery remains out of scope.

## ISSUE-24 preparation (not installed)

`RESTORE_TEST_REPO` accepts `1` (legacy default) or `2`. It selects the same
repository for info/restore and checks freshness only in that repository and
stanza. Run the two checks serially; the host lock prevents overlap. The new
`pgbackrest_restore_repository_last_success_timestamp_seconds{repo="N"}` metric
requires per-repository alerts before activation; the aggregate metric remains
for the existing monitor. No scheduler or alerts are activated by these files.

`pgbackrest-hardening.conf.example` is an incomplete, credential-free fragment
for the selected B2/encryption/retention policy. It cannot replace the existing
template. Live compose/template/renderer, installed version, archive command,
spool settings, scheduler, endpoint/bucket/region/URI style and secret mount
contracts are still needed. The override replaces every volume, so file-based
secrets require explicit reviewed mounts before encrypted restore acceptance.
Keep the legacy config and prefix; never enable encryption over its objects.
