# Artifact Keeper as Tagaroa's container registry

Research date: 2026-11-14. Primary sources only: Artifact Keeper's repositories (backend source, compose files, Dockerfiles, migrations, changelog, CI workflows, test harness, docs site, Helm chart), its GitHub releases, issues and security advisories, Cloudflare's R2 docs, Traefik's and Pangolin's own configuration and docs, PostgreSQL, PgBouncer, Docker and skopeo docs. Source citations are pinned to Artifact Keeper **v1.11.13** (commit `a94c2fd`), released 2026-11-10. Facts about Tagaroa's machines are the ones verified on 2026-11-13/14 and given with the brief; nothing was checked on the VM or CT 105 for this note. Anything that could not be confirmed is marked **unverified**.

Link prefixes used below:

- `AK` = `https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13`
- `AK-test` = `https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962`
- `AK-docs` = `https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs`
- `AK-helm` = `https://github.com/artifact-keeper/artifact-keeper-iac/blob/2d39fcccbc0bf3628ab3529862143afe957574e7/charts/artifact-keeper`

All of them are written out in full in the links.

## 1. Summary

**Recommendation: no-go for now.** It becomes a go with conditions once the three conditions in section 14 hold. Until then, keep Zot for dev and OCIR for prod.

- **It can do the job on paper.** It publishes arm64 images, supports PostgreSQL 16 and later (its own CI runs 18), and needs only the `pg_trgm` extension. Its S3 backend names R2 as a supported store and uses no S3 feature R2 lacks. Its OCI registry accepts Docker manifest lists and OCI indexes, stores manifests byte for byte, and supports cross-repository mounts, chunked uploads and the referrers API. API tokens can be scoped to one repository, and GitHub Actions OIDC can replace a stored token.
- **Our exact path is untested upstream.** No R2 test, issue or code path exists in the project. Its object-store tests run on MinIO. The upstream OCI conformance suite is wired up as a test tier, but no workflow runs it. The blocking release gate checks plain `docker push`/`pull`, not `buildx` per-arch pushes, `docker manifest push` or `skopeo copy --all`. R2 also requires equal-sized multipart parts, which Artifact Keeper only produces for blobs under about 4.9 GiB.
- **The project is young, fast-moving and has had serious auth bugs.** The repository is 10 months old. It shipped 59 stable releases between 2026-04-02 and 2026-11-10, and only the latest release is supported. A 1.11 database cannot be rolled back to 1.10 without a restore. It has 49 published security advisories: 2 critical and 23 high, mostly authorization and token scoping, which is exactly what a CI registry relies on. One maintainer wrote about 2,300 of its commits; the next human contributor wrote 55.
- **Exposure is the hardest part for us.** CT 105 has no known private path to the OCI VM, so the registry would have to be a public Pangolin resource with Pangolin's sign-in off. That puts the whole Artifact Keeper API surface (45+ formats, admin API) on the internet.
- **The gain is small.** It removes `--insecure` and plain HTTP, and could remove OCIR. In exchange it adds a large service to a VM with 2 vCPUs. It also moves every merge's image pushes, and every dev deploy's pulls, from the home LAN onto the internet. Zot stays anyway for the other projects.

If you still want to try it, section 12 is the exact change set and a staged rollout that never touches the current path until a real build has passed on Artifact Keeper.

### Decision, 2026-11-14

Exposure is settled: Artifact Keeper is **internal, on NetBird only**, like Plane and Multica, and never a public Pangolin resource. That meets condition 1 in section 14 once CT 105 reaches it, which it cannot today (checked 2026-11-14):

- CT 105 has no NetBird client and cannot connect to the VM's NetBird addresses (`172.25.251.2`, `172.25.251.33`).
- Its Docker network `tms-development_default` uses `172.25.0.0/16`, which overlaps NetBird's `172.25.25x` addresses; CT 105 currently routes `172.25.251.2` to that bridge. Docker on CT 105 has no `default-address-pools`, so any new network can land on that range again.

So the order is: give CT 105's Docker an address pool outside `172.25.0.0/16` and recreate `tms-development_default` on it, join CT 105 to NetBird, then run stage 2 of the rollout (section 12). Zot and OCIR stay as they are until stage 2 passes.

## 2. What Tagaroa needs

From [deploy-dev.yml](../../.github/workflows/deploy-dev.yml), [release.sh](../../infra/release/release.sh), [deploy-dev.md](../ops/workflows/deploy-dev.md), [release-prod.md](../ops/workflows/release-prod.md) and [NOTES.md](../ops/NOTES.md):

- On every merge, CT 105 builds `core` once per platform with `docker buildx build --platform linux/<arch> --provenance=false --sbom=false --push` to `10.10.10.14:8080/tagaroa/core:<sha>-<arch>`. It joins the two with `docker manifest create --insecure` and `docker manifest push --insecure --purge`. It also pushes `web-dev:<sha>` (amd64) and `web-prod:<sha>` (arm64).
- Dev on CT 105 pulls `core` (amd64) and `web-dev` from Zot.
- A release checks that `core` and `web-prod` have a `linux/arm64` image. It then runs `skopeo copy --all --preserve-digests --src-tls-verify=false` to `sin.ocir.io`, and refuses unless `sha256(skopeo inspect --raw)` of source and destination match. The VM then pulls from OCIR through `deploy.sh`, which logs in with `/home/tagaroa/apps/.ocir`.
- `.release.env` stores image refs, and `release.sh` reads the previous prod sha back as the text after the last `:` of `CORE_IMAGE`. Image refs must therefore keep the form `<registry>/<path>:<sha>`.

So the registry must take per-arch pushes, a Docker manifest list built by `docker manifest`, and HEAD/GET by digest. It must also serve the exact bytes pushed, so that the release's digest check means something.

## 3. What Artifact Keeper is and how it is built

A Rust/Axum backend serving 45+ package formats, Docker/OCI among them, under the MIT licence ([README](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/README.md), [LICENSE](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/LICENSE)). The repository was created on 2026-01-15 (GitHub API).

| Component                               | Needed by us?           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend (`artifact-keeper-backend`)     | Yes                     | Serves `/v2/` and `/api/v1/` on `BIND_ADDRESS` (default `0.0.0.0:8080`) and gRPC on 9090 ([config.rs L1832](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/config.rs#L1832), [.env.example L178-L189](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.env.example#L178-L189)).                                                                                                                                                                                                                                 |
| PostgreSQL                              | Yes                     | `DATABASE_URL` and `JWT_SECRET` are the only settings startup refuses to run without ([config.rs L1830-L1849](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/config.rs#L1830-L1849)).                                                                                                                                                                                                                                                                                                                                            |
| Storage: filesystem, S3, GCS or Azure   | Yes (S3, for R2)        | `STORAGE_BACKEND`, default `filesystem` ([config.rs L1835](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/config.rs#L1835)).                                                                                                                                                                                                                                                                                                                                                                                                     |
| Web UI (`artifact-keeper-web`, Next.js) | No                      | "Optional (API-first)" ([architecture](https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs/getting-started/architecture.mdx#L41-L50)). Released and versioned separately from the backend (#2708, [docker-compose.yml header](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docker-compose.yml)). First-run setup works through the API ([setup.rs](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/middleware/setup.rs#L17-L45)). |
| OpenSearch                              | No                      | `OPENSEARCH_URL` is optional ([config.rs L1882](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/config.rs#L1882)). Search falls back to PostgreSQL ([architecture](https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs/getting-started/architecture.mdx#L50)). `/readyz` only waits for it when `READYZ_REQUIRE_SEARCH` is set.                                                                                                                           |
| Trivy server, scanner adapter, OpenSCAP | No                      | All optional URLs ([config.rs L1869-L1879](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/config.rs#L1869-L1879)). Grype is compiled into the backend image ([Dockerfile.backend L420-L503](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docker/Dockerfile.backend#L420-L503)). Scanning is per repository, and the schema default is off ([022_security_scanning.sql L8-L9](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/migrations/022_security_scanning.sql#L8-L9)).          |
| Dependency-Track                        | No                      | Off by default. "Holds 3-4 GiB of RAM" ([.env.example L866-L875](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.env.example#L866-L875)).                                                                                                                                                                                                                                                                                                                                                                                                    |
| Caddy (in the stock compose)            | No (Pangolin does this) | [docker-compose.yml](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docker-compose.yml).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Images and arm64.** CI builds the backend natively for `linux/amd64` and `linux/arm64`, the arm64 leg on GitHub-hosted `ubuntu-24.04-arm` ([docker-publish.yml L516-L547](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.github/workflows/docker-publish.yml#L516-L547)). On 2026-11-14 the registry API returned an OCI index with `linux/amd64` and `linux/arm64` (plus two `unknown/unknown` attestation entries) for `ghcr.io/artifact-keeper/artifact-keeper-backend:1.11.13`. The same holds for `artifact-keeper-web:1.11.2`, the newest web release ([package](https://github.com/artifact-keeper/artifact-keeper/pkgs/container/artifact-keeper-backend)). The arm64 backend image's layers add up to **640 MiB compressed**. Images are also on Docker Hub as `artifactkeeper/backend` ([compose header](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docker-compose.yml)). The base is Red Hat UBI 9, and the image runs as non-root ([Dockerfile.backend L3](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docker/Dockerfile.backend#L3), [README](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/README.md)).

## 4. Resource needs on the OCI VM

- The docs ask for "4 GB RAM minimum (8 GB recommended)" for the full compose stack ([deployment/docker](https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs/deployment/docker.mdx#L13-L16)). That stack includes OpenSearch with a 512 MiB heap, Trivy, OpenSCAP and the web UI.
- The Helm chart's defaults are the only per-component numbers published. Backend: requests 250m CPU / 256 MiB, limits 2 CPU / 2 GiB. Web: 250m / 256 MiB, limits 1 CPU / 1 GiB. OpenSearch: 1 GiB request, 2 GiB limit ([values.yaml L586-L593, L828-L835, L1166-L1174](https://github.com/artifact-keeper/artifact-keeper-iac/blob/2d39fcccbc0bf3628ab3529862143afe957574e7/charts/artifact-keeper/values.yaml#L586-L593)).
- **Backend only fits.** Run the backend alone with `mem_limit: 2g` and `cpus: 1`. That leaves about 3.8 GiB of the ~5.8 GiB now available. Disk: 640 MiB compressed for the image (unpacked size **unverified**) plus a small scratch volume. OCI uploads stage on the storage backend, not on local disk ([upload-scratch-disk.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/upload-scratch-disk.md)).
- 1.11.13 switched the image to jemalloc after RSS grew to 3.9 GiB under bursts of proxy downloads ([CHANGELOG L39](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/CHANGELOG.md#L39)). We would not proxy anything.
- CPU during a push, from hashing and copying on a 2-vCPU box beside prod, is **unverified**. Measure it in the trial (section 12). Leave scanning off: it would run Grype on the same two cores.

## 5. PostgreSQL

- **Version 18 is fine.** The docs say "PostgreSQL: 16 or later" ([installation](https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs/getting-started/installation.mdx#L91)). The stock compose and every CI workflow use `postgres:18-alpine` ([docker-compose.yml](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docker-compose.yml)). The move from 16 to 18 shipped in 1.9.0 ([CHANGELOG L2010-L2021](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/CHANGELOG.md#L2010)). The "PostgreSQL 16" in the README diagram is stale.
- **Extensions: only `pg_trgm`** ([004_artifacts.sql L2](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/migrations/004_artifacts.sql#L2)). It is a trusted extension, so a database owner without superuser can create it ([PostgreSQL 18 docs](https://www.postgresql.org/docs/18/pgtrgm.html)). No migration up to `339` creates roles, alters the system or the database, or needs superuser (searched `backend/migrations/` on the tag).
- **Migrations run at startup**, before the HTTP listener binds, from `sqlx::migrate!` embedded in the binary ([main.rs L218](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/main.rs#L218), [CHANGELOG L2965](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/CHANGELOG.md#L2965)). `SKIP_MIGRATIONS=true` turns that off and is also the supported rollback path ([rollback.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/rollback.md)). Some releases forbid mixed versions; 1.11.0's migration 233 says "Do not do a rolling or mixed-version deploy" ([CHANGELOG L765](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/CHANGELOG.md#L765)). With one replica, we would stop, pull and start.
- **Pool size.** Defaults are 50 max and 5 min per replica. The project warns that its defaults "do not fit a stock Postgres" ([.env.example L28-L92](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.env.example#L28-L92), [config.rs L2082](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/config.rs#L2082)). With ~42 of 100 connections in use, set `DATABASE_MAX_CONNECTIONS=10` and `DATABASE_MIN_CONNECTIONS=1`. Extra out-of-pool lock connections only appear with `PROXY_SINGLEFLIGHT_ADVISORY_LOCKS_ENABLED`, which is off by default ([.env.example L447-L472](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.env.example#L447-L472)).
- **Not through PgBouncer.** The backend takes session-level advisory locks (`pg_advisory_lock` / `pg_try_advisory_lock` in [cluster_lock.rs L257, L334](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/services/cluster_lock.rs#L257)) and sets per-session GUCs after connecting ([db.rs L28-L80](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/db.rs#L28-L80)). PgBouncer in transaction mode "never" supports session-level advisory locks ([PgBouncer features](https://www.pgbouncer.org/features.html)). So connect straight to `postgres:5432` on `postgres_backend`, as Tagaroa core already does ([NOTES.md](../ops/NOTES.md), "Decisions so far").
- **A separate database and role in the shared cluster is reasonable:** `CREATE ROLE artifact_keeper LOGIN PASSWORD '…'; CREATE DATABASE artifact_keeper OWNER artifact_keeper;`. pgBackRest is cluster-level, so it covers the new database, and the weekly restore test already lists every connectable database ([restore-test.sh L40](../../infra/oci/postgres/restore-test.sh)).

## 6. Storage on Cloudflare R2

**Configuration.** These settings come from the header of [s3.rs L1-L58](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/storage/s3.rs#L1-L58), which lists R2 among "S3-compatible services":

- `STORAGE_BACKEND=s3`
- `S3_BUCKET`
- `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `S3_REGION`, which defaults to `us-east-1` ([L851](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/storage/s3.rs#L851))
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`
- optional `S3_PREFIX`

R2's region is `auto`, and both empty and `us-east-1` alias to it ([R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)). Set `S3_REGION=auto`. The client is the `object_store` crate (0.14.2) built with `AmazonS3Builder::new()`, never switched to virtual-hosted style ([s3.rs L1615-L1627](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/storage/s3.rs#L1615-L1627)). The project's docs say its URLs "keep path-style addressing" ([presigned-downloads.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/presigned-downloads.md)). R2 accepts path-style: Cloudflare's own `aws s3 presign` example returns `https://<ACCOUNT_ID>.r2.cloudflarestorage.com/my-bucket/…` ([R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)). Give it an R2 token with "Object Read & Write" limited to the one bucket ([R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/)).

**S3 features it relies on, against R2.** Artifact Keeper uses GET, PUT, HEAD and DELETE, DeleteObjects (with `S3_DISABLE_MULTI_DELETE` as a fallback), ListObjectsV2, multipart create/upload/complete/abort, CopyObject, and UploadPartCopy (only for copies over 5 GiB) ([s3.rs](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/storage/s3.rs)). R2 implements all of these ([R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)). Artifact Keeper sets no checksum algorithm, no conditional put (`PutMode`), and no ACLs or tags (none appear in `backend/src` on the tag). R2's gaps therefore do not apply: ACLs, object tagging, versioning, object lock and full-object CRC32/SHA checksums. Presigned URLs are not used unless enabled (below).

**Where R2 differs and it matters:**

- **Equal part sizes.** R2 refuses a multipart upload whose non-trailing parts differ in size ("All non-trailing parts must have the same size", error 10048) ([R2 error codes](https://developers.cloudflare.com/r2/api/error-codes/), [upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/)).
  - For a stream of unknown length, Artifact Keeper cuts 5 MiB parts for the first 1,000 parts and then doubles the part size. A stream of known length gets one fixed part size ([s3.rs L130-L168](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/storage/s3.rs#L130-L168)). Uploads of up to about 4.88 GiB are therefore uniform. A larger blob streamed without a length would, by reading the code, fail on R2 (**unverified**; the project has no R2 test).
  - A single-part upload is promoted with a server-side copy. Multi-part uploads are concatenated into a temporary object through the same `put_stream` writer and re-hashed, so the same rule covers them ([oci_v2.rs L8385-L8400, L8547](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/oci_v2.rs#L8385-L8400)).
  - Tagaroa's layer sizes were not measured. They are expected to be far below 4.88 GiB (**unverified**).
- **Single upload and copy limit.** R2 caps a single upload or copied part at 4.995 GiB ([R2 limits](https://developers.cloudflare.com/r2/platform/limits/)). Artifact Keeper's single-copy ceiling defaults to 5 GiB (`S3_MAX_SINGLE_COPY_BYTES`, [s3.rs L35-L40](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/storage/s3.rs#L35)). This only matters for blobs near 5 GiB.
- **One write per second per key.** R2 answers 429 above one write per second to the same key ([R2 limits](https://developers.cloudflare.com/r2/platform/limits/)). Blob keys are content-addressed, so this needs two simultaneous pushes of the same new layer. Our builds run one after another.

**Streaming or redirect.** By default every byte goes through Artifact Keeper (`PRESIGNED_DOWNLOADS_ENABLED=false`). When redirects are enabled, a blob GET answers `307` to a presigned URL, and "HEAD requests are never redirected" ([.env.example L440-L446](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.env.example#L440-L446), [presigned-downloads.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/presigned-downloads.md)). R2's endpoint is public, so a redirect would work for CT 105 and the VM, and R2 egress is free ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)). Start with redirects off: fewer moving parts. Whether our Docker and skopeo versions follow the 307 cleanly is **unverified**.

**Uploads and finalize time.** OCI blob uploads are staged under `oci-uploads/` in the bucket ([upload-scratch-disk.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/upload-scratch-disk.md), [oci_v2.rs L1102](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/oci_v2.rs#L1102)). On the final `PUT`, the backend verifies the digest, server-side copies the object to its content-addressed key and records it, and only then answers ([oci-reverse-proxy-timeouts.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/oci-reverse-proxy-timeouts.md)). On object stores that copy still grows with layer size: "about 13 s for 5 GiB on a local MinIO". containerd 2.3+ waits only 30 s for response headers (open [#5219](https://github.com/artifact-keeper/artifact-keeper/issues/5219), follow-up to [#5133](https://github.com/artifact-keeper/artifact-keeper/issues/5133) "Timeout on large docker image"). The same copy on R2, from Singapore, is **unverified** and must be timed in the trial. R2 also expires incomplete multipart uploads after seven days by default ([object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)).

**Upstream testing.** On 2026-11-14 no issue, code or test in the `artifact-keeper` org mentions R2 or `r2.cloudflarestorage` (GitHub search). The release gate's tiers run against "postgres/minio/keycloak/squid" ([release-gate.yml L3211-L3214](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/.github/workflows/release-gate.yml#L3211)). Artifact Keeper on R2 is therefore **unverified upstream**.

**Location and cost.** Create the bucket with location hint `apac`; a hint is honoured only on the bucket's first creation ([data location](https://developers.cloudflare.com/r2/reference/data-location/)). Standard storage is $0.015 per GB-month with 10 GB-month free, Class A operations are $4.50 per million, and egress is free ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)).

## 7. OCI distribution support for our pipeline

| Need                                                   | Status in v1.11.13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Our image names                                        | The first path segment is the repository key ([oci_v2.rs L3217-L3232](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/oci_v2.rs#L3217-L3232)). `registry.tagaroa.cc/tagaroa/core:<sha>` means repository `tagaroa`, image `core`. Our names keep working unchanged.                                                                                                                                                                                                                                                                                        |
| Docker manifest list / OCI index                       | Both media types are accepted. The stored content type follows the body and keeps the client's header when the two agree ([oci_v2.rs L2355-L2367, L2440-L2446](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/oci_v2.rs#L2440-L2446)). Child manifests are recorded for GC protection (#1179).                                                                                                                                                                                                                                                            |
| Digest preserved, bytes verbatim                       | Digest = SHA-256 of the request body. The manifest is stored under that digest, and a PUT by digest that does not match is refused with `DIGEST_INVALID` ([oci_v2.rs L12056-L12069](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/oci_v2.rs#L12056-L12069)). The blocking gate asserts pulled digest = pushed digest with the real Docker client ([test-docker-native-client.sh L213-L273](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/tests/formats/test-docker-native-client.sh#L213-L273)). |
| `buildx` per-arch push, `docker manifest push --purge` | Plain image-manifest and manifest-list PUTs, which the handler supports. Neither command appears in the project's tests (org-wide code search on 2026-11-14). **Unverified.** Docker marks `docker manifest` experimental ([Docker docs](https://docs.docker.com/reference/cli/docker/manifest/)); we already depend on it.                                                                                                                                                                                                                                                                          |
| Monolithic and chunked blob uploads                    | Both supported. Chunked upload is tested in [test-oci.sh L136-L184](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/tests/formats/test-oci.sh#L136). A retried completion `PUT` is idempotent since 1.11.7 ([oci-reverse-proxy-timeouts.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/oci-reverse-proxy-timeouts.md)).                                                                                                                                                                                  |
| Cross-repo mount                                       | Implemented, `?mount=&from=` (#3109) ([oci_v2.rs L6580](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/oci_v2.rs#L6580)).                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| HEAD on blobs and manifests                            | Supported. HEAD is never redirected. Range GETs were added in #3586.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Referrers API                                          | Implemented from `subject` at PUT time (#3108) ([oci_v2.rs L2473-L2480](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/oci_v2.rs#L2473)). An open bug affects virtual repositories only ([#5792](https://github.com/artifact-keeper/artifact-keeper/issues/5792)). We do not need it today.                                                                                                                                                                                                                                                               |
| `skopeo copy --all --preserve-digests`                 | skopeo fails rather than change a digest ([skopeo-copy(1) v1.25.1](https://github.com/containers/skopeo/blob/v1.25.1/docs/skopeo-copy.1.md)), so a bad registry shows up as a failed copy, not a silent change. skopeo appears in the test repo only for Nexus migration and catalog pagination. **Unverified** as source or destination.                                                                                                                                                                                                                                                            |
| Tag immutability                                       | Not available for hosted Docker repositories (open [#5135](https://github.com/artifact-keeper/artifact-keeper/issues/5135)). Anyone with write access can move `core:<sha>`.                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Conformance suite.** An `oci-conformance` tier runs the upstream `opencontainers/distribution-spec` v1.1.0 suite (pull, push, content discovery) against a filesystem-backed instance. Delete stays off "because … `DELETE /v2/<name>/blobs/<digest>` currently 405s" ([manifest](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/deploy-test/harness/tiers/oci-conformance/manifest), [oracle.sh](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/deploy-test/harness/tiers/oci-conformance/oracle.sh)). However, no workflow in that repository names the tier. Its required and advisory matrices list other tiers ([release-gate.yml L3264-L3490, L3971-L4010](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/.github/workflows/release-gate.yml#L3264)). The project's own curl suite, which covers image indexes, referrers and cross-mounts ([test-oci-conformance.sh](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/tests/formats/test-oci-conformance.sh)), runs only in the non-blocking audit lane ([format-tests.yml L105-L160](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/.github/workflows/format-tests.yml#L105)). Blocking OCI coverage is `test-oci.sh`, `test-oci-remote.sh`, `test-docker-native-client.sh` and the DTF OCI tiers.

**Open OCI bugs worth knowing:**

- [#5869](https://github.com/artifact-keeper/artifact-keeper/issues/5869): invalid tags are accepted.
- [#5901](https://github.com/artifact-keeper/artifact-keeper/issues/5901): raw database error text appears in `/v2` error messages.
- [#5219](https://github.com/artifact-keeper/artifact-keeper/issues/5219): finalize time on object stores.

## 8. Auth for CI pushes and pulls

- **`docker login` works with an API token.** On format routes, including `/v2/`, a request is accepted with "HTTP Basic with the API token in the password field. The username can be anything" ([service-account access](https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs/advanced/service-account-access.mdx)). The docs show `docker login --password-stdin` with a token ([Docker guide](https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs/guides/docker.mdx#L34-L39)). `/v2/token` rate-limits password grants ([oci_v2.rs L14002-L14031](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/oci_v2.rs#L14002)).
- **Robot accounts are service accounts** (`/api/v1/service-accounts`, `POST /:id/tokens` with `scopes`, `repository_ids` and `expires_in_days`) ([service_accounts.rs L30-L45, L109-L122](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/service_accounts.rs#L30-L45)).
  - Access needs two checks to pass: the token's repository list (empty means unrestricted), and a grant on the repository for the account, given directly or through group _membership_ ([service-account access](https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs/advanced/service-account-access.mdx)).
  - The default scope is `read:artifacts`. `delete:*` and `admin` are admin-only ([profile.rs L77-L99](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/handlers/profile.rs#L77-L99)).
  - Token expiry is optional; the policy is off by default ([api-token-expiration-policy.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/api-token-expiration-policy.md)).
- **Plan:** one service account `ci-tagaroa` with write on repository `tagaroa` and a token limited to that repository, for CT 105. A second, read-only token for the VM.
- **Keyless option.** `POST /api/v1/auth/ci/token` exchanges a GitHub Actions OIDC token (`id-token: write`) for a short-lived token for a mapped service account. Claim filters decide which jobs qualify, and an allowed-repository list confines it ([ci-oidc.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/ci-oidc.md)). This would remove the stored CI secret, at the cost of one more feature to configure. Artifact Keeper must reach GitHub's OIDC discovery URL or hold a static JWKS.
- **Anonymous pull is on unless switched off.** Guest access defaults to `true` ([guest_access_policy.rs L1-L25, L65](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/services/guest_access_policy.rs#L1-L25)). Repositories are `public`, `internal` or `private` ([repository-visibility.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/repository-visibility.md)). Set `AK_GUEST_ACCESS_ENABLED=false` and make `tagaroa` private.
- **History of the controls we would rely on:**
  - [GHSA-qh2h-m7hp-27pc](https://github.com/artifact-keeper/artifact-keeper/security/advisories/GHSA-qh2h-m7hp-27pc) (high): repository-restricted tokens were not confined to their repositories.
  - [GHSA-4vhv-xq85-2ffj](https://github.com/artifact-keeper/artifact-keeper/security/advisories/GHSA-4vhv-xq85-2ffj) (critical): a read-only token could escalate to write.
  - [GHSA-vvc3-h39c-mrq5](https://github.com/artifact-keeper/artifact-keeper/security/advisories/GHSA-vvc3-h39c-mrq5) (high): read-scoped service-account tokens were accepted on push paths.

  All three are fixed.

## 9. Exposure

**What must reach what:**

- CT 105 pushes four images per merge and pulls two for dev.
- The VM's Docker pulls two arm64 images per release.
- Artifact Keeper reaches Postgres on `postgres_backend` and R2 over the internet (through `oci_egress`, as prod core does, per [infra/prod/compose.yml](../../infra/prod/compose.yml)).

**Ingress options:**

- **Pangolin public resource** `registry.tagaroa.cc` → the backend container on `pangolin_default`, the same way prod's web is published ([release-prod.md](../ops/workflows/release-prod.md)). Docker clients cannot complete Pangolin's browser sign-in, so registry traffic must match a "Bypass Auth" rule. Pangolin rules match on path, CIDR, country or region ([Pangolin rules](https://github.com/fosrl/docs/blob/9787f24c49d4c709edf2cf31f3ce93508d3b90f4/content/docs/manage/access-control/rules.mdx)).
  - A CIDR rule for the home WAN address, with block for everything else, keeps it off the open internet. That only works if the address is stable (**unknown**).
  - Without that rule, the whole backend is public: `/api/v1`, the admin API and every format route. Path rules are a weak fence, because Pangolin matches each segment separately, so `v2/*` does not cover deeper paths.
- **NetBird only**, with the rule shape dev already uses: bypass the NetBird gateway `172.25.250.3`, block everything else ([deploy-dev.md](../ops/workflows/deploy-dev.md)). This keeps the registry private. CT 105 would have to join NetBird. Today it reaches Multica over the LAN rather than through the proxy ([deploy-dev.yml](../../.github/workflows/deploy-dev.yml), `MULTICA_SERVER_URL`), so it is probably not a peer (**unverified**). A NetBird client inside an LXC needs a TUN device or userspace mode (**unverified**).

**TLS.** Pangolin's Traefik issues Let's Encrypt certificates on `websecure` ([Pangolin traefik_config.yml](https://github.com/fosrl/pangolin/blob/1.26.0/install/config/traefik/traefik_config.yml)). That removes `--insecure` and `--src-tls-verify=false`. Set `AK_EXTERNAL_URL=https://registry.tagaroa.cc` so the bearer realm and links use the public URL rather than request headers ([extractors.rs L144-L230](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/api/extractors.rs#L144)).

**Size limits and timeouts:**

- Traefik limits request bodies only when the `buffering` middleware is attached ([Traefik buffering](https://github.com/traefik/traefik/blob/v3.7.19/docs/content/reference/routing-configuration/http/middlewares/buffering.md)).
- `readTimeout`, the maximum time to read the whole request including the body, defaults to 60 s. `writeTimeout` defaults to 0 (none) and `idleTimeout` to 180 s ([Traefik entrypoints](https://github.com/traefik/traefik/blob/v3.7.19/docs/content/reference/install-configuration/entrypoints.md)).
- Pangolin's installer raises `websecure` `readTimeout` to `30m` ([Pangolin traefik_config.yml](https://github.com/fosrl/pangolin/blob/1.26.0/install/config/traefik/traefik_config.yml)). The backend-side `responseHeaderTimeout` defaults to 0 ([Traefik serversTransport](https://github.com/traefik/traefik/blob/v3.7.19/docs/content/reference/routing-configuration/http/load-balancing/serverstransport.md)).
- So a stock Pangolin will not cut a layer push that finishes within 30 minutes. Whether the VM's live Traefik config still has these values, and whether Pangolin's `badger` auth plugin buffers bodies on bypassed requests, are **unverified**.
- Artifact Keeper recommends a response timeout of 3,600 s on `/v2/` for multi-GB layers ([oci-reverse-proxy-timeouts.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/oci-reverse-proxy-timeouts.md)). `MAX_UPLOAD_SIZE` defaults to 10 GiB ([config.rs L2031](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/config.rs#L2031)).

**Behind the proxy:**

- Set `RATE_LIMIT_TRUSTED_PROXY_CIDRS` to the `pangolin_default` subnet. The compose default is `172.30.0.0/24`.
- Keep `XFF_TRUSTED_FOR_AUTHZ=false`. [GHSA-59x8-r6jj-x95h](https://github.com/artifact-keeper/artifact-keeper/security/advisories/GHSA-59x8-r6jj-x95h) was exactly that trust going wrong.
- Set `GRPC_BIND_IP=127.0.0.1`, since we do not use gRPC ([.env.example L178-L189](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.env.example#L178-L189)).

**The VM pulling from itself.** `docker pull registry.tagaroa.cc/…` on the VM goes out to its own public IP and back. Whether OCI's internet gateway allows that hairpin is **unverified**. The fallback is `127.0.0.1 registry.tagaroa.cc` in the VM's `/etc/hosts`, which only works if Gerbil publishes 443 on the host (**unverified**). A loopback-only port avoids TLS, because Docker treats 127.0.0.0/8 as insecure automatically ("may change in the future", [dockerd docs](https://docs.docker.com/reference/cli/dockerd/#insecure-registries)). But the token realm would still point at the public name.

## 10. Backups and restore

| State                                                                                               | Lives in                   | Covered by                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users, service accounts, tokens, repository config, tag → manifest map, blob index, upload sessions | Postgres `artifact_keeper` | pgBackRest (cluster-level, PITR) and the weekly restore test                                                                                                                                                                                                                                                                  |
| Blobs, manifests, upload staging                                                                    | R2 bucket                  | Nothing. R2's S3 API has no versioning or object lock ([R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/)). R2 bucket locks exist ([bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)) but would collide with Artifact Keeper overwriting or deleting keys; **untested**, not recommended. |
| `JWT_SECRET`, DB password, R2 keys, admin password                                                  | `.env` on the VM (0600)    | Same handling as prod's `.env` today                                                                                                                                                                                                                                                                                          |
| Scratch volume, Grype cache                                                                         | Local volumes              | Disposable                                                                                                                                                                                                                                                                                                                    |

- **Keep blob GC in dry-run.** A point-in-time restore brings back rows whose blobs blob GC may since have deleted. Blob GC only deletes when `BLOB_GC_ENABLED=true`; otherwise the hourly pass reports only ([config.rs L1996-L2000](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/backend/src/config.rs#L1996-L2000)). Keep it off, so a PITR restore never points at a deleted blob. The cost is that storage only grows until a retention policy plus GC is designed against the PITR window.
- **Do not use Artifact Keeper's own backup feature** (`BACKUP_PATH`, `BACKUP_S3_BUCKET`). Its restore had a high-severity bug, [GHSA-95fx-g94v-8jqg](https://github.com/artifact-keeper/artifact-keeper/security/advisories/GHSA-95fx-g94v-8jqg). pgBackRest plus R2 already covers it.
- **Dropping OCIR also drops prod's second copy.** Today prod's images live in OCIR, apart from Zot. If OCIR goes, the only copy of every prod image is in one R2 bucket. Losing it means rebuilding from git, and whether our builds are reproducible to the same digest is **unverified**. That is a reason to keep OCIR, at least at first.

## 11. Upgrades and maturity

- **Cadence.** 59 stable releases from v1.1.0 (2026-04-02) to v1.11.13 (2026-11-10), about two a week. v1.11.0 to v1.11.13 took 28 days ([releases](https://github.com/artifact-keeper/artifact-keeper/releases)). "Only the latest release is supported … older lines do not receive backports" ([support policy](https://github.com/artifact-keeper/artifact-keeper-site/blob/2c2c1e441f919f82720eff2f0b17936fd9b54e8d/src/content/docs/docs/getting-started/support-policy.mdx), [SECURITY.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/SECURITY.md)). Every security fix therefore means taking the newest release.
- **Breaking changes and migration safety:**
  - A database that ran the 1.11.0 migrations "cannot serve a 1.10.x backend for OCI and Docker pushes"; going back means restoring a pre-upgrade backup ([rollback.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/rollback.md)).
  - 1.11.0's migration 233 requires stopping every old replica first ([CHANGELOG L765](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/CHANGELOG.md#L765)).
  - 1.11.13's migration 339 takes a brief exclusive lock and can make old replicas fail findings reads ([CHANGELOG L55](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/CHANGELOG.md#L55)).
  - 1.9.0 moved the bundled Postgres to 18 with a new mount path ([CHANGELOG L2012](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/CHANGELOG.md#L2012)).
  - Many entries carry "Upgrade note" or "BREAKING" API changes (for example storage GC's request body, [CHANGELOG L1743-L1747](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/CHANGELOG.md#L1743)).
  - A CI gate now rejects migrations that block writes on hot tables ([online-migrations.md](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/operations/online-migrations.md)).
  - In July the v1.5.8 tag was reused for two commits ([incident](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/docs/audits/release-v1.5.8-incident-2026-07-15.md)). Releases now go through a candidate-then-promote gate ([release-candidate.yml](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.github/workflows/release-candidate.yml)).
- **Bus factor.** `brandonrc` has 2,298 commits on the default branch, `dependabot` 187, and the next human 55. The stats API counts 95 contributors (GitHub contributors API, 2026-11-14).
- **Open issues.** 196 open issues by label: 92 enhancement, 46 bug, 25 security, 16 hardening, 15 conda, and 5 Docker ([issues](https://github.com/artifact-keeper/artifact-keeper/issues)). A FIPS epic and conda scale work dominate recent activity.
- **Security advisories.** 49 published: 2 critical, 23 high, 19 medium and 5 low. Five came in July 2026 and 44 in October 2026, most of them on 2026-10-19 ([advisories](https://github.com/artifact-keeper/artifact-keeper/security/advisories)). Themes: authorization bypasses, token scope and escalation, SSRF, SAML and path traversal. The two criticals were a SAML signature wrapping escalation to admin ([GHSA-v7x5-xgjc-352p](https://github.com/artifact-keeper/artifact-keeper/security/advisories/GHSA-v7x5-xgjc-352p)) and read-only token escalation ([GHSA-4vhv-xq85-2ffj](https://github.com/artifact-keeper/artifact-keeper/security/advisories/GHSA-4vhv-xq85-2ffj)).
- **License.** MIT.

## 12. If we go ahead: concrete changes and rollout

**Cloudflare.**

- Bucket `tagaroa-registry`, location hint `apac`.
- R2 API token with Object Read & Write on that bucket only.
- DNS `registry.tagaroa.cc` → 168.107.65.35, unless a wildcard covers it ([NOTES.md](../ops/NOTES.md)).

**Postgres** (as root on the VM): `docker exec postgres psql -U postgres -c "CREATE ROLE artifact_keeper LOGIN PASSWORD '…'" -c "CREATE DATABASE artifact_keeper OWNER artifact_keeper"`.

**New `infra/oci/artifact-keeper/compose.yml`** (backend only; no web UI, OpenSearch or scanners):

```yaml
name: artifact-keeper
services:
  backend:
    image: ghcr.io/artifact-keeper/artifact-keeper-backend:1.11.13 # pin; upgrade deliberately
    restart: unless-stopped
    env_file: .env # secrets only, 0600, never in git
    environment:
      ENVIRONMENT: production
      STORAGE_BACKEND: s3
      S3_REGION: auto
      STORAGE_PATH: /data/storage # scratch only; blobs live in R2
      AK_EXTERNAL_URL: https://registry.tagaroa.cc
      AK_GUEST_ACCESS_ENABLED: "false"
      PLUGINS_ENABLED: "false"
      GRPC_BIND_IP: 127.0.0.1
      DATABASE_MAX_CONNECTIONS: "10"
      DATABASE_MIN_CONNECTIONS: "1"
      BLOB_GC_ENABLED: "false" # keep PITR restores consistent (section 10)
      XFF_TRUSTED_FOR_AUTHZ: "false"
    volumes: [scratch:/data/storage]
    mem_limit: 2g
    cpus: 1
    networks: [postgres, egress, pangolin]
volumes:
  scratch: {}
networks:
  postgres: { external: true, name: postgres_backend }
  egress: { external: true, name: oci_egress }
  pangolin: { external: true, name: pangolin_default }
```

`.env` holds:

- `DATABASE_URL=postgres://artifact_keeper:…@postgres:5432/artifact_keeper`
- `JWT_SECRET`
- `ADMIN_PASSWORD` (first boot)
- `PEER_API_KEY`, so startup does not log a random one
- `S3_BUCKET`, `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `RATE_LIMIT_TRUSTED_PROXY_CIDRS=<pangolin_default subnet>`

Add a `README.md` beside the compose file with these keys and the upgrade rule: read the release notes, stop, pull, start, never mixed versions.

Monitoring: add a scrape job for `METRICS_PORT` and a blackbox probe on `/livez` to `infra/oci/monitoring/` ([.env.example L183-L190](https://github.com/artifact-keeper/artifact-keeper/blob/v1.11.13/.env.example#L183)).

**Pangolin.** Resource `registry.tagaroa.cc` on the OCI VM's local site → `artifact-keeper-backend-1:8080`. Rules: either the NetBird shape (bypass `172.25.250.3`, block all) or bypass the home WAN CIDR and block all. Never public with auth off.

**Bootstrap (API only).**

1. Log in as admin and change the password (setup mode).
2. `POST /api/v1/repositories` with `{"key":"tagaroa","name":"tagaroa","format":"docker","repo_type":"local","is_public":false}` (the shape used by [oracle.sh](https://github.com/artifact-keeper/artifact-keeper-test/blob/11ec13d9c9d4baba36bf0cd077a27d0a8626d962/deploy-test/harness/tiers/oci-conformance/oracle.sh)).
3. Create service account `ci-tagaroa` and grant it write on `tagaroa`.
4. Mint a token limited to `tagaroa` with `read:artifacts,write:artifacts` and store it as GitHub secret `REGISTRY_TOKEN`.
5. Create service account `vm-tagaroa` with read only, and put its token in `/home/tagaroa/apps/.registry` (0600).
6. Check: `curl -si https://registry.tagaroa.cc/v2/` must answer 401 with `realm="https://registry.tagaroa.cc/v2/token"`.

**`deploy-dev.yml`:**

- `REGISTRY: registry.tagaroa.cc`.
- A login step, `printf '%s' "$REGISTRY_TOKEN" | docker login "$REGISTRY" -u ci --password-stdin`.
- `docker manifest create` and `docker manifest push --purge` without `--insecure`.
- An `if: always()` step running `docker logout "$REGISTRY"`. The runner keeps its Docker client config between jobs.

`infra/dev/deploy.sh` needs nothing new, because it runs in the same runner client.

**`release.sh`, two options:**

- **Keep OCIR (recommended first).** Change only the source:
  - `dev_registry=registry.tagaroa.cc`
  - drop `--src-tls-verify=false` and `--tls-verify=false`
  - log skopeo in to the registry, or use `--src-creds`, with the same token

  The digest check, the prod pull from OCIR and `.ocir` stay as they are. Prod never depends on Artifact Keeper being up, and keeps a copy outside R2.

- **Drop OCIR (later).**
  - Remove the copy loop and the OCIR secrets.
  - Keep the arm64 check against the registry.
  - Pass `registry.tagaroa.cc/tagaroa/core:<sha>` and `…/web-prod:<sha>` to `deploy.sh`. The `CORE_IMAGE=…:<sha>` parsing still works.
  - Swap `.ocir` for `.registry` in `infra/prod/deploy.sh`.
  - The digest comparison then has nothing to compare. Replace it by recording the index digest at dev deploy and checking it before deploy, because tags are mutable (section 7).

**Docs:**

- [NOTES.md](../ops/NOTES.md): Registries and Machines.
- [deploy-dev.md](../ops/workflows/deploy-dev.md): registry, login, no `--insecure`, no `insecure-registries` need for Tagaroa.
- [release-prod.md](../ops/workflows/release-prod.md): promote step, secrets, one-time setup.
- [infra/prod/README.md](../../infra/prod/README.md): secrets.

**Staged rollout.** Each stage is reversible by reverting one commit; Zot and OCIR stay untouched until the end.

1. **Install beside Zot.** Stand Artifact Keeper up as above, with no pipeline change. Confirm `/livez`, the 401 challenge, and Postgres connections staying within 10.
2. **One real build, by hand on CT 105**, as `tagaroa` with the runner's Docker client, for the current `main` sha:
   - Run the exact `buildx` × 2, `docker manifest create`/`push --purge` and both web builds from `deploy-dev.yml`, against `registry.tagaroa.cc`.
   - Then run the release's own check twice:
     - `skopeo copy --all --preserve-digests` from Zot to `registry.tagaroa.cc/tagaroa/core-zot:<sha>`, with Artifact Keeper as destination.
     - From there to a scratch OCIR repository, with Artifact Keeper as source.
     - Compare `sha256(skopeo inspect --raw)` at each hop.
   - Pull `core` on the VM (arm64) and on CT 105 (amd64) and compare `RepoDigests`.
   - Time every push. Watch Artifact Keeper logs for 409/503 completion retries and Traefik logs for 499/504.
   - Restart the backend once mid-push and check the retry recovers.
   - Afterwards, check that `oci-uploads/` in R2 is empty.
3. **Shadow for two weeks.** `deploy-dev.yml` keeps pushing to Zot, then copies each image to Artifact Keeper with `skopeo copy --all --preserve-digests`. Dev and releases still use Zot and OCIR. Any failure here costs nothing.
4. **Switch.** Dev pulls from Artifact Keeper, and `release.sh` copies from Artifact Keeper to OCIR. Stop pushing to Zot.
5. **Optional.** Drop OCIR only after one release and one `deploy.sh --rollback` drill through Artifact Keeper.

## 13. Risks and open questions

1. **Private path for CT 105.** Is CT 105, or the Proxmox LAN, a NetBird peer, and can an LXC run the client? If not, is the home WAN address stable enough for a Pangolin CIDR rule? Without one of these the registry is public. That is the main blocker.
2. **R2 is untested upstream** (section 6). The equal-part rule gives a ~4.88 GiB per-blob ceiling for streams. There is also R2's one write per second per key.
3. **Finalize latency to R2** versus client response-header timeouts ([#5219](https://github.com/artifact-keeper/artifact-keeper/issues/5219)). Measure in stage 2.
4. **Our multi-arch flow is unexercised upstream** (`buildx` per-arch push, `docker manifest push`, `skopeo copy --all`). Stage 2 is the test.
5. **Upgrade burden.** Only the latest release is supported, about two releases a week ship, and rollbacks across minors can need a database restore. Someone must own reading release notes and upgrading within days of a security release.
6. **Attack surface.** A 45-format server whose recent advisories cluster in authorization, guarding the images prod runs. Tags are mutable (#5135).
7. **The VM pulling from its own public hostname** (hairpin or `/etc/hosts`). **Unverified.**
8. **The VM's live Traefik timeouts** and whether `badger` buffers bodies. **Unverified;** read the config on the VM.
9. **WAN dependency for dev.** Every merge uploads changed layers of four images from home, and every dev deploy downloads two. Dev breaks when the home uplink or the VM is down. Image and layer sizes have not been measured.
10. **Storage growth.** With blob GC off, R2 only grows. A tag retention policy plus GC has to be designed against the PITR window.
11. **Headroom.** 2 GiB more committed on a VM with ~5.8 GiB available and 53 containers.

## 14. Recommendation

**No-go for now.** Artifact Keeper's OCI and S3 support looks complete in the source. But the combination we would run (R2, `buildx` per-arch pushes joined by `docker manifest`, `skopeo copy --all --preserve-digests`, behind Pangolin) is not tested by the project. The registry would have to face the internet from a 10-month-old codebase with 25 critical or high advisories, most of them in authorization. For a registry that holds what prod runs, that is the wrong trade for the benefits: TLS on a LAN-only registry, and possibly dropping OCIR.

**It becomes a go with conditions when all of these hold:**

1. CT 105 reaches it privately, over NetBird or a stable-address CIDR rule, so it is never public with auth off.
2. Stage 2 of the rollout passes on R2 with the exact pipeline commands: digests equal at every hop, no timeouts, staging cleaned up, and push times acceptable.
3. Someone owns upgrades: subscribed to the repository's security advisories and upgrading within a week of a security release. OCIR stays prod's registry until several releases have gone through Artifact Keeper.

If the real goal is only TLS for Zot, or only removing OCIR, smaller changes probably exist (for example a second Zot on the VM). They were not researched here.
