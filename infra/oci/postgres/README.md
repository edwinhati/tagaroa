# Restore verification

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

Tagaroa database checks are required once the live database exists. Before then,
the test checks Pangolin, NetBird and Arcane. This verifies restore capability in
the current OCI tenancy; separate-account disaster recovery remains out of scope.
