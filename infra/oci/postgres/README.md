# Restore verification

Run on the OCI PostgreSQL host as root. The compose override replaces every
volume and network from the live service. The restore uses a fresh data volume,
a dedicated network with repository egress, and a Unix socket with no published
port. Cleanup runs on success and failure. A host lock prevents overlapping runs.

Install `restore-test.sh` and `restore-container.sh`
in `/home/docker/postgres/pgbackrest/`, alongside the existing config template.
Install the service and timer in `/etc/systemd/system/`, then:

```sh
systemctl daemon-reload
systemctl start pgbackrest-restore-test.service
systemctl enable --now pgbackrest-restore-test.timer
systemctl list-timers pgbackrest-restore-test.timer
```

The script reuses the PostgreSQL service's repository credentials. Each run writes
its log to `restore-test-last.log` beside the script, pass or fail. The service has a
30-minute timeout; readiness and promotion have a 10-minute timeout. Both paths clean
up scratch containers, volumes and networks. What a run does, step by step, is in
`docs/ops/workflows/restore-test.md`.

To verify the failure path without touching a backup or live database:

```sh
RESTORE_TEST_STANZA=verification-missing-stanza bash /home/docker/postgres/pgbackrest/restore-test.sh
```

This intentionally fails; read `restore-test-last.log` for the failing step.

A successful run records a timestamp in VictoriaMetrics, and `TagaroaRestoreTestStale`
reads it with a range query (`max_over_time(...[9d])`), so a single weekly sample stays
visible between runs. Install both scripts together, and apply
`infra/oci/monitoring/alerts.yml` with them. Run the local regression checks without
Docker or repository access:

```sh
sh infra/oci/postgres/restore-test.test.sh
sh infra/oci/postgres/restore-container.test.sh
```

This verifies restore capability in the current OCI tenancy; separate-account
disaster recovery remains out of scope.
