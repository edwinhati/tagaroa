# Multica

How this repo uses [Multica](https://multica.engineering.tagaroa.cc) to run coding agents against GitHub work.

## Setup

- **Server:** self-hosted at https://multica.engineering.tagaroa.cc, workspace "Tagaroa".
- **Project:** one project, "Tagaroa". Its resource is the `edwinhati/tagaroa` GitHub repo, so every run starts from a fresh clone.

## Agents

| Agent | Runtime | Role                                      |
| ----- | ------- | ----------------------------------------- |
| Mika  | Claude  | Lead engineer: features and bugs          |
| Rex   | Codex   | Review, tests, CI and dependency upgrades |

## Workflow

- **Todo** starts the assignee.
- Entering **In Review** hands the issue to Rex for review.
- When every linked PR merges, the issue moves to **Done**.

## Merging PRs

Always **squash and merge** (`gh pr merge <n> --squash`). The repo only allows squash merges and deletes the head branch on merge, so one PR is one commit on `main` and no merged branches pile up. Agents never merge their own PRs; the squash commit title is the PR title, so keep the `ISSUE-N:` prefix.

## Linking PRs to issues

Put the issue ID (e.g. `ISSUE-12`) in the branch name or PR title, or write `Closes ISSUE-12` in the PR body.

The GitHub App `tagaroa-multica` is read-only: it observes PRs but never pushes or comments.

## Autopilots

All three run as Rex.

- **Weekly dependency check:** Mondays 09:00 Asia/Jakarta.
- **QA failed on main:** the `notify-multica` job in `.github/workflows/qa.yml` calls the autopilot's webhook through the repo secret `MULTICA_QA_WEBHOOK`. It runs on the self-hosted deploy runner. Besides pushes to main, which run Chromium alone, QA runs every browser project (Chromium, Firefox, WebKit, mobile Chromium) every Sunday at 01:00 UTC (08:00 Asia/Jakarta), so a failing weekly run opens an issue too. PRs run every browser project and never open an issue.
- **Ops alert:** opens an issue when prod is down, a dev deploy fails, the release brief cannot be updated after a good dev deploy, or the monthly restore test fails; Rex diagnoses read-only and hands it to edwinhati in Todo. Its webhook URL is in the repo secret `MULTICA_OPS_WEBHOOK` and, on the OCI VM, in Alertmanager (`infra/oci/monitoring/`). Send to it with `infra/ops/ops-alert.sh`. See `docs/ops/workflows/ops-alerts.md`.

## Labels

Issues use the triage labels listed in `docs/agents/triage-labels.md`.

## Skills

The repo's `.agents/skills` are imported into Multica as copies, so edits here do not reach Multica on their own. After changing a skill, re-import it:

```sh
multica skill import --file <zip> --on-conflict overwrite
```
