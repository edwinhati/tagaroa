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

None. The QA, ops-alert and dependency-check autopilots were removed on 2026-11-13 (ISSUE-108): Multica is reachable only through NetBird, so their senders could not get in. A failing workflow shows in GitHub only.

## Labels

Issues use the triage labels listed in `docs/agents/triage-labels.md`.

## Skills

The repo's `.agents/skills` are imported into Multica as copies, so edits here do not reach Multica on their own. After changing a skill, re-import it:

```sh
multica skill import --file <zip> --on-conflict overwrite
```
