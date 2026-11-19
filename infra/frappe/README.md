# Frappe HR

Tagaroa's self-hosted Frappe HR: the employee record that `servers/core`'s `hr` module reads
([ADR 0004](../../docs/adr/0004-hr-record-drives-joiners-and-leavers.md)). One site per stack,
reachable only through NetBird.

| File           | What it is                                                                   |
| -------------- | ---------------------------------------------------------------------------- |
| `apps.json`    | ERPNext, HRMS and the private app `erp`, each pinned to a tag                |
| `build.sh`     | Builds `tagaroa-frappe:<tag>` on the host from frappe_docker and `apps.json` |
| `compose.yaml` | MariaDB, Redis, backend, websocket, workers, scheduler, frontend on loopback |
| `backup.sh`    | Nightly `bench backup --with-files`, copied off the host with rclone         |

## Host

A Proxmox LXC of its own on the PVE host (`root@10.10.10.2`), like Multica's CT 107. Not the OCI
VM: that is the network and observability host, and its RAM stays under 50%. Not CT 105 either.

- **Size:** 2 vCPU, 4 GB RAM, 30 GB disk, amd64.
- **LXC:** Docker needs `nesting=1,keyctl=1`. Pin DNS like every CT:
  `pct set <id> --nameserver 8.8.8.8 --searchdomain infra.engineering.tagaroa.com`.
- **Install** into `/home/docker/frappe`.
- **Network:** outbound HTTPS to GitHub and `tagaroa.cc`, and a way to reach
  `git.engineering.tagaroa.cc` when building. Set `HTTP_BIND` to the CT's LAN address.

## Customising

Every change Tagaroa makes to ERPNext or Frappe HR lives in the private app `erp`, in the GitLab
project [`tagaroa/frappe/erp`](https://git.engineering.tagaroa.cc/tagaroa/frappe/erp). Never
patch `frappe`, `erpnext` or `hrms` themselves: a custom app survives upgrades, and a patched
fork has to be merged on every release. A product on another site, such as a public Helpdesk,
gets its own app and repo in the same `tagaroa/frappe` group.

bench clones each app into `apps/<repo name>`, so a repo must never be named after an app the
bench already has (`frappe`, `erpnext`, `hrms`, `helpdesk`, ...).

The app is proprietary and never leaves the group. Running it for the group's own staff does not
trigger the GPL-3.0 obligations of ERPNext and HRMS; handing the code or an image containing it
to anyone else would.

## `.env`

Not in git; `0600`, owned by `docker`.

| Key             | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| `FRAPPE_TAG`    | The tag given to `build.sh`, e.g. `16.53.2-0.0.1` (HRMS, then `erp`) |
| `SITE`          | The site name, which is also its host name, e.g. `hr.tagaroa.cc`     |
| `DB_PASSWORD`   | MariaDB root password, `openssl rand -base64 32`                     |
| `HTTP_BIND`     | Address the frontend listens on; the CT's LAN IP, default loopback   |
| `HTTP_PORT`     | Port for the frontend; defaults to `8080`                            |
| `BACKUP_REMOTE` | rclone destination, e.g. `r2:tagaroa-frappe-backups`                 |

`rclone.conf` sits next to it, also `0600`, with the remote `BACKUP_REMOTE` names. For R2, use a
token with Object Read & Write on that bucket only, and set the retention as a lifecycle rule on
the bucket.

## Build

Make a project access token on `tagaroa/frappe/erp` (**Settings → Access tokens**) with the
**Reporter** role and the `read_repository` scope only. Then, on the host:

```sh
GIT_USER=oauth2 GIT_TOKEN=... sh build.sh 16.53.2-0.0.1
```

The token reaches the build as a BuildKit secret. bench also writes it into `logs/bench.log`, so
`build.sh` deletes that log in the build stage, and fails and deletes the image if the token
still turns up inside it. The build cache on the host keeps a copy of the build stage; run
`docker builder prune` after building if the host is shared.

## First start

The commands here and below run in the install directory with `.env` loaded
(`set -a; . ./.env; set +a`), so `$SITE` and `$BACKUP_REMOTE` are set.

```sh
docker compose up -d
docker compose exec backend bench new-site "$SITE" \
  --mariadb-user-host-login-scope='%' \
  --install-app erpnext --install-app hrms --install-app erp
docker compose exec backend bench --site "$SITE" enable-scheduler
```

`new-site` asks for the MariaDB root password (`DB_PASSWORD`) and the new Administrator
password, so neither lands in shell history. Then open the site through the private ingress and
finish the setup wizard.

## Connecting to Tagaroa

1. **Access.** Add the site to the private ingress and NetBird the way
   [Artifact Keeper](../oci/artifact-keeper/README.md#access) is: a Pangolin resource on site
   "PVE Home" on the "Private ingress only" policy, pointing at `${HTTP_BIND}:${HTTP_PORT}`, an
   address from `add-private-app.py`, a NetBird resource and a DNS zone for `SITE`. The core
   service on the OCI VM calls `FRAPPE_URL` too, so that path must let it through.
2. **Webhook path.** Frappe calls `https://tagaroa.cc/api/hr/webhooks/frappe`. Pangolin resource
   39 drops every path it does not list, so add `ACCEPT PATH /api/hr/webhooks/*` to it first.
3. **The sync.** Follow [Connecting Frappe HR](../../docs/security/frappe-hr-setup.md): the
   read-only API user, the signed webhook and the four `FRAPPE_*` settings on `servers/core`.

## Backups

As the user that runs compose:

```sh
crontab -e   # 15 2 * * * sh /home/docker/frappe/backup.sh >>/home/docker/frappe/backup.log 2>&1
```

Restore a backup at least once before relying on it, onto a scratch stack:

```sh
rclone copy "$BACKUP_REMOTE/$SITE" ./restore --max-age 25h
docker compose cp ./restore backend:/tmp/restore
docker compose exec backend bench --site "$SITE" restore /tmp/restore/<stamp>-<site>-database.sql.gz \
  --with-public-files /tmp/restore/<stamp>-<site>-files.tgz \
  --with-private-files /tmp/restore/<stamp>-<site>-private-files.tgz
docker compose exec backend bench --site "$SITE" migrate
```

`<site>` is `SITE` with dots turned into underscores.

## Upgrades

Monthly, or sooner for a security release.

1. Pick tags at least a week old. `FRAPPE_VERSION` in `build.sh` must exist as both
   `frappe/build` and `frappe/base` image tags on Docker Hub; they trail Frappe's releases. Pin
   ERPNext and HRMS in `apps.json`; HRMS's `pyproject.toml` lists the Frappe and ERPNext ranges
   it supports.
2. Merge the change, then on the host: pull, `sh build.sh <new tag>`, and run `sh backup.sh`.
3. Set `FRAPPE_TAG` to the new tag, then:

   ```sh
   docker compose up -d
   docker compose exec backend bench --site "$SITE" migrate
   ```

4. If the migration fails, put the old `FRAPPE_TAG` back and restore the backup from step 2.

An `erp` release is the same: tag it in its repo, pin the tag in `apps.json`, rebuild.
