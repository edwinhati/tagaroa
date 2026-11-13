# OCI VM monitoring

Source of `/home/docker/monitoring` on the OCI edge VM (`ubuntu@168.107.65.35`), only the
files this repo owns. The VM copy must match. Install by hand:

```sh
scp -r infra/oci/monitoring/{compose.yaml,alerts.yml,victoriametrics} ubuntu@168.107.65.35:/tmp/mon-new/
# on the VM, for each changed file:
sudo install -o docker -g docker -m 0644 /tmp/mon-new/<file> /home/docker/monitoring/<file>
sudo docker compose --project-directory /home/docker/monitoring -f /home/docker/monitoring/compose.yaml up -d
```

Files are bind-mounted one by one, so a replaced file is invisible to a running container
until it restarts: `sudo docker restart victoriametrics vmalert` after changing
`scrape.yml` or `alerts.yml`.

Not in git: `.env`.

vmalert evaluates the rules in `alerts.yml` but notifies nobody (`-notifier.blackhole`);
firing alerts show only in vmalert. The Alertmanager that routed Tagaroa's alerts to
Multica was removed in ISSUE-108. On a VM that still runs it, install the new
`compose.yaml` as above, then:

```sh
sudo docker compose --project-directory /home/docker/monitoring -f /home/docker/monitoring/compose.yaml up -d --remove-orphans
sudo docker volume ls -q | grep alertmanager_data | xargs -r sudo docker volume rm
sudo rm -r /home/docker/monitoring/alertmanager
```
