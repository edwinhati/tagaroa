# Artifact Keeper on the OCI VM

Source of `/home/docker/artifact-keeper` on the OCI VM (`ubuntu@168.107.65.35`). It is Tagaroa's
image registry, reachable only through NetBird; blobs live in Cloudflare R2, metadata in the
VM's Postgres. Why and how: [docs/research/artifact-keeper-2026-11.md](../../../docs/research/artifact-keeper-2026-11.md).

## `.env`

Not in git; `0600`, owned by `docker`.

| Key                                        | Value                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | `postgres://artifact_keeper:<password>@postgres:5432/artifact_keeper?sslmode=disable`     |
| `JWT_SECRET`                               | `openssl rand -base64 48`                                                                 |
| `PEER_API_KEY`                             | `openssl rand -hex 32`; set so startup does not log a random one                          |
| `S3_BUCKET`                                | `tagaroa-artifact-registry`                                                               |
| `S3_ENDPOINT`                              | `https://<account id>.r2.cloudflarestorage.com`, without the `/<bucket>` Cloudflare shows |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | An R2 token with Object Read & Write on that bucket only                                  |

## Install

Once, as root on the VM. The backend holds its whole pool (`DATABASE_MAX_CONNECTIONS`, 10) open,
so the role's limit leaves only a little room:

```sh
docker exec postgres psql -U postgres \
  -c "CREATE ROLE artifact_keeper LOGIN PASSWORD '<password>' CONNECTION LIMIT 12" \
  -c "CREATE DATABASE artifact_keeper OWNER artifact_keeper"
```

Then:

```sh
scp infra/oci/artifact-keeper/compose.yaml ubuntu@168.107.65.35:/tmp/
# on the VM:
sudo install -d -o docker -g docker -m 0750 /home/docker/artifact-keeper
sudo install -o docker -g docker -m 0644 /tmp/compose.yaml /home/docker/artifact-keeper/compose.yaml
sudo docker compose --project-directory /home/docker/artifact-keeper up -d
```

The first boot writes a random admin password to `/data/storage/admin.password`; read it with
`sudo docker exec artifact-keeper cat /data/storage/admin.password` and change it at
first sign-in. Until then the backend is in setup mode, and `/v2/` answers 403.

## Access

`https://registry.engineering.tagaroa.cc`, over NetBird only:

- **Pangolin** resource `crazy-northern-pika` on site "Oracle Cloud VM SG", shared policy
  "Private ingress only" (every public address is dropped). Two targets: regex
  `^/(api|v2|health|livez|readyz)(/.*)?$` → `artifact-keeper:8080` at priority 200, and
  everything else → `artifact-keeper-web:3000` at priority 100.
- **Private ingress** `private-registry` at `172.25.251.19`, added with
  `/home/docker/private-ingress/add-private-app.py --key registry`. Its routes regenerate from
  Pangolin every 15 seconds.
- **NetBird** resource "Artifact Keeper" (`172.25.251.19/32`, group Engineering Applications) and
  DNS zone `registry.engineering.tagaroa.cc` with an A record to `172.25.251.19`.

## Upgrades

Only the latest backend release is supported, and a rollback across minor versions can need a
database restore. Read the release notes, then stop, pull and start; never run two versions at
once. The web UI is released separately: pin the newest web release of the same minor. Update
each tag and digest together.
