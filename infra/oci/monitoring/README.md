# OCI VM monitoring

Source of `/home/docker/monitoring` on the OCI edge VM (`ubuntu@168.107.65.35`), only the
files this repo owns. The VM copy must match. Install by hand:

```sh
scp -r infra/oci/monitoring/{compose.yaml,alerts.yml,victoriametrics,alertmanager} ubuntu@168.107.65.35:/tmp/mon-new/
# on the VM, for each changed file:
sudo install -o docker -g docker -m 0644 /tmp/mon-new/<file> /home/docker/monitoring/<file>
sudo docker compose --project-directory /home/docker/monitoring -f /home/docker/monitoring/compose.yaml up -d
```

Files are bind-mounted one by one, so a replaced file is invisible to a running container
until it restarts: `sudo docker restart victoriametrics vmalert alertmanager` after
changing `scrape.yml`, `alerts.yml` or `alertmanager.yml`.

Not in git: `.env`, and `alertmanager/ops-webhook-url`, the "Ops alert" webhook URL
(owner `65534`, mode `0600`, see `docs/ops/workflows/ops-alerts.md`).

Alerts labelled `team: tagaroa` go to Rex through Alertmanager; all others go to a null
receiver.

## Before the first prod release

Prod does not exist yet, so `TagaroaProdDown` fires as soon as it is installed. An
Alertmanager silence on `alertname="TagaroaProdDown"` (30 days from 2026-10-31, comment
names ISSUE-10) keeps Rex from getting an issue a day. The first prod release expires it:

```sh
A="sudo docker exec alertmanager amtool --alertmanager.url=http://localhost:9093"
$A silence query alertname=TagaroaProdDown
$A silence expire <id>
```

If prod is still not live when it runs out, Rex gets a daily issue; extend it with
`$A silence update <id> --duration=720h`.
