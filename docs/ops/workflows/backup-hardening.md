# Encrypted and offsite backups (ISSUE-24)

Status: implementation proposal for review; nothing here changes live backups.
Provider and retention selected for preparation; spending, secrets and execution remain with Edwin. Do not install
these examples as a replacement for the live configuration.

## Repository evidence and missing inputs

`../NOTES.md` records PostgreSQL 18 on the OCI Singapore VM, stanza `main`, OCI
bucket `tagaroa-postgres-backups`, daily differential backups around 03:15 UTC,
and retention of one full and four differential backups with encryption disabled.
The full-backup cadence is not recorded. These are documented settings, not a
fresh inspection of production.

`infra/oci/postgres/restore-test.sh` reuses `compose.yaml`, the live environment
and `pgbackrest.conf.template`; the image renders `/run/pgbackrest.conf`.
Neither that compose file, template, renderer, image build nor
`backup-housekeeping.py` is tracked here. There is no infra workspace CONTEXT.md;
`CONTEXT-MAP.md` classifies infra as deployment and ops outside the workspaces.
Do not invent environment variable names or modify a renderer we cannot inspect.

Before an execution PR, obtain a redacted copy of those files and record:

- Installed pgBackRest version and supported options; PostgreSQL data path,
  archive command, spool/queue settings and current repository prefix.
- Existing full/diff schedule, expiration behavior, bucket lifecycle rules,
  successful backup labels, sizes, WAL volume and required recovery window.
- Selected second provider, independent account owner/recovery access, region,
  bucket, endpoint, S3 region and URI style; TLS must remain verified.
- Secret injection mechanism usable by both backup and restore containers:
  separate scoped repository credentials and cipher passphrases. Record secret
  references and custodians only, never their values. Recovery copies must be
  accessible without the OCI account; losing a passphrase loses its backups.
- Approved RPO/RTO, retention, budget and maintenance window. The existing
  restore check's 48-hour freshness threshold is not a PITR/RPO guarantee.

## Offsite decision

Decision recorded on ISSUE-24: Backblaze B2 is repo2 in an account separate from
OCI, with client-side pgBackRest encryption and continuous WAL archiving.
Weekly full and daily differential backups, two full chains and four differentials
per repository are approved for preparation. Account provisioning and activation
remain unauthorized. The alternatives below are historical comparison only.

Options checked against official documentation on 2026-11-05. S3 API support
alone is not proof of compatibility with the installed pgBackRest version.

| Candidate | Benefit | Decision or validation needed |
| --- | --- | --- |
| AWS S3 in a separately controlled account | Different provider/account; native S3 object storage | Region, recovery access, storage/request/restore-transfer budget and scoped policy |
| Cloudflare R2 in an independently recoverable account | Different provider; S3-compatible endpoint | S3 API differences, endpoint/region/URI settings, residency and isolated restore trial |
| Another OCI region in the existing tenancy | Geographic separation | Does not meet the account-loss objective; cannot be the only offsite copy |

Edwin must approve measured costs and account provisioning before activation.
Compare measured backup/WAL traffic, requests and a complete restore transfer,
not storage price alone. B2 is selected; no account has been created or purchased.

### Measurement and activation budget gate

The [B2 pricing page](https://www.backblaze.com/cloud-storage/pricing), checked
2026-11-05, publishes $6.95/TB/month and free egress up to three times average
monthly storage, then $0.01/GB. Recheck region and billing terms at activation.
Use decimal TB/GB when applying those rates. This is no spending commitment.

Before activation record actual compressed/encrypted object bytes for two full
chains, four retained differentials, required WAL, metadata and any retained
object versions. Measure daily byte-hours across at least two full cycles to
derive average monthly storage `S` in TB; count the temporary third full during
rotation and legacy OCI retention separately for peak capacity. Backup logical
database size alone is insufficient. Record a measured independent restore's
download volume and expected monthly rehearsal/incident frequency as egress `E`
in decimal GB. Include other account egress when calculating shared allowances.

Conservative B2 monthly model (before any free storage credit):
`6.95 * S + 0.01 * max(0, E - 3000 * S)` USD. Add OCI outbound transfer,
OCI storage/legacy overlap, taxes and any applicable account-specific charges
separately. Record source measurements, sample dates, expected normal cost and
peak restore cost for Edwin's approval. Storage/WAL/restore measurements are
currently unavailable, so a numeric workload estimate would be invented.

B2 endpoint, bucket, region and URI style must come from the selected account
and installed-version compatibility trial. No endpoint or credential is assumed.

Sources: [AWS S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html),
[R2 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/).
The account-loss assessment follows from keeping both copies under the same
account; a second region alone cannot remove that dependency.

## Proposed configuration contract

Review-only additions for **new, empty repository prefixes**, combined later
with the inspected live stanza, paths and transport settings. Keep stanza `main`
where possible so the existing restore convention remains valid. A fresh prefix
creates a distinct backup history without renaming the database stanza.
Never toggle encryption over the existing unencrypted repository.

```ini
[global]
repo1-cipher-type=aes-256-cbc
repo1-retention-full-type=count
repo1-retention-full=2
repo1-retention-diff=4
repo2-type=s3
repo2-cipher-type=aes-256-cbc
repo2-retention-full-type=count
repo2-retention-full=2
repo2-retention-diff=4
```

This intentionally incomplete fragment contains no credentials or deployable
endpoints. Supply new repo1/repo2 paths and the selected transport inputs through
the real renderer after review. Inject `repo1-cipher-pass` and
`repo2-cipher-pass` securely; never put secrets in command arguments or logs.
Preserve the old repo1 transport settings only after inspecting them.

Selected schedule: weekly full plus daily differential **per repository**, with
two full chains and four differentials retained in each, plus continuous WAL.
Recovery-window, measured cost and activation approval remain required.
Count retention does not promise a fixed number of days if jobs fail or extra
fulls are taken. Preserve WAL needed by retained backups; do not add independent
bucket lifecycle deletion or aggressive archive expiration. Do not enable auto
expiration during migration until the new namespaces and retention are verified.

Backups must explicitly target each repository: a backup invocation without a
repository selector does not mean both are backed up. Inspect and revise the
housekeeping scheduler to run and report each separately. Archiving to multiple
repositories can couple availability: test an offsite outage and spool/disk
pressure before activation; do not weaken WAL durability to mask errors.

See the [pgBackRest configuration reference](https://pgbackrest.org/configuration.html)
and [multiple-repository guide](https://pgbackrest.org/user-guide.html#multi-repo).
Recheck syntax against the installed version before executing.

## Safe migration sequence (future authorized operator work)

1. Inventory the missing inputs above. Preserve the original rendered config,
   template, credential references, backup labels and restore procedure in secure
   operator storage. Confirm an isolated restore of the current chain first.
   No stanza deletion, bucket purge or credential rotation is part of this plan.
2. Confirm selected B2 account recovery access and approve measured budget. Prepare new empty
   prefixes for both encrypted repositories. Test the renderer and secret access
   in isolation; do not print a rendered secret-bearing config in CI or an issue.
3. With the approved candidate configuration, initialize stanza `main` in both
   new empty repositories using `stanza-create`, before enabling candidate WAL
   delivery or running candidate archive checks. Keep the legacy archive command
   and backup schedule unchanged during this initialization.
4. Gate the archive rehearsal on inspection of the live archive command,
   renderer and queue behavior. Before any future live archive change, review an
   explicit mechanism that continues WAL delivery to the legacy repository while
   also delivering to both initialized candidates, including failure/retry and
   spool capacity behavior. This repository does not contain enough evidence to
   prescribe that mechanism. If continuity to all three destinations cannot be
   demonstrated, stop; do not redirect the live archive command for rehearsal.
   A separate config file alone does not arrange continuous WAL delivery.
   This initial candidate archive configuration is a separately authorized change
   before the final scheduler/config cutover in step 7. After it is approved and
   enabled, verify archive checks and required WAL in each candidate and continued
   legacy WAL delivery. Keep the legacy backup schedule active.
5. Only after initialization and candidate archive checks pass, take a full backup in each
   using explicit `--repo=1` and `--repo=2` selectors. Capture labels and timestamps.
   Differential backups from the old unencrypted history cannot seed this chain.
   Serialize backups on the small VM. Do not claim a fresh full is recoverable
   until required WAL and archive checks pass for that repository.
6. Restore each new repository independently into fresh volumes with no live
   mounts, ports or database networks. Pin `--repo=N` and the recorded backup
   `--set=LABEL`; capture `info --repo=N --output=json` for that same repository.
   Test the existing database/schema assertions and backup freshness. Also prove
   recovery with OCI repository access unavailable and secrets recovered outside
   OCI. `--type=immediate` tests consistency, not a requested point-in-time target;
   rehearse PITR separately if it is an approved requirement.
7. Only after both restores pass, authorize the final scheduler/config cutover and
   per-repository failure/freshness monitoring. Observe full and differential
   cycles and archive health before allowing the approved expiration policy.
   Explicitly review when legacy WAL delivery may stop; candidate archiving was
   already established in step 4, not deferred to this final cutover.
   Retain the legacy prefix/config for the approved compatibility window. Its
   last archived WAL bounds its recovery horizon after cutover; it is not current
   protection once new writes stop being archived there.

If checks fail, leave old objects untouched, retain candidate objects for
diagnosis and restore the approved prior configuration/schedule only after
verifying WAL continuity. If continuity is uncertain, take a fresh full on the
working configuration and verify it; do not advertise rollback as gap-free.
Do not delete either history as a rollback step.

## Restore compatibility and acceptance

The prepared monthly runner defaults to stanza `main`, repo `1`; set
`RESTORE_TEST_REPO=2` to test B2 separately. Both `info` and `restore` receive
the same selector; freshness uses only the selected stanza and repository.
It emits an additional per-repository success timestamp. The legacy aggregate
metric remains for compatibility and cannot prove both repositories work. Its volume
override also replaces all secret-file mounts; any new file-based secret delivery
must be mounted explicitly and tested. Environment inheritance alone is not enough
to prove that new cipher/credential material reaches the rendered config.

Before activating two repositories, wire two serial runner invocations into the
inspected scheduler, ensuring the second runs even if the first fails and the
combined job fails if either fails. Configure per-repository freshness alerts on
`pgbackrest_restore_repository_last_success_timestamp_seconds{repo="1"}` and
`{repo="2"}`, including missing-series detection. These changes require the live
scheduler and monitoring inventory; they are not activated by this preparation.
The runner selects the newest backup implicitly; an acceptance rehearsal must
also pin and record a backup set through a separately reviewed runner extension.
Preserve the isolation/cleanup and application checks in `restore-test.md`.
The legacy unencrypted chain still requires its original config with cipher
type `none`; the encrypted config cannot read it. Keep restore instructions for
both histories until the operator approves retiring legacy recovery points.

Execution acceptance: full and differential backups in each repository; retained
chains and required WAL present; independently verified restores; offsite recovery
without OCI access; recoverable cipher secrets; outage alerts and safe retry;
no live volume touched. This documentation PR does not satisfy those live gates.

For this preparation change, review repository evidence and upstream option
names, check relative links and run `git diff --check`. Repository AGENTS.md
exempts Markdown-only changes from local CI. No backup, restore, deployment or
secret operation should run as part of this documentation validation.
