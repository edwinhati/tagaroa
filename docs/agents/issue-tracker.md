# Issue tracker: Multica

Issues and specs for this repo live in Multica (workspace "Tagaroa"), not GitHub Issues. Use the `multica` CLI for all issue operations; run `multica issue --help` for the full list. IDs look like `ISSUE-12`. The workflow, statuses, and PR linking are in `docs/agents/multica.md`.

Add `--output json` when parsing output; `issue create`, `label create` and `issue assign` already default to JSON.

## Conventions

- **Create an issue**: `multica issue create --title "..." --description-file <path>`. Write multi-line bodies to a file inside the working directory first. Add `--priority`, `--status` or `--assignee` as needed.
- **Read an issue**: `multica issue get <id> --output json`, then `multica issue comment list <id> --output json` for the comments.
- **List issues**: `multica issue list --status <status> --output json`, with `--assignee`, `--priority` or `--limit` as needed. Labels come back on each issue in JSON.
- **Search issues**: `multica issue search "<query>"` (titles, descriptions and comments). Add `--include-closed` to include done and cancelled issues.
- **Comment on an issue**: `multica issue comment add <id> --content-file <path>`.
- **Apply / remove labels**: `multica issue label add <id> <label-id>` / `multica issue label remove <id> <label-id>`. Labels are addressed by ID, so find it with `multica label list`.
- **Change status**: `multica issue status <id> <status>`, where status is a key: `backlog`, `todo`, `in_progress`, `in_review`, `blocked`, `done`, `cancelled`.
- **Close**: `multica issue comment add <id> --content-file <path>`, then `multica issue status <id> done` (or `cancelled`; add `--duplicate-of <original>` for a duplicate).
- **Assign**: `multica issue assign <id> --to <name>`. Assigning to an agent starts a run unless you pass `--no-start`.

The CLI uses the workspace and project from its configured environment; no repo inference is needed.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

PRs stay on GitHub, so this section still uses `gh pr`. When set to `yes`, PRs run through the same labels and states as issues:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

`gh` PR numbers (`#42`) and Multica issue IDs (`ISSUE-12`) are separate; link a PR to its issue as described in `docs/agents/multica.md`.

## When a skill says "publish to the issue tracker"

Create a Multica issue with `multica issue create`. Never open a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `multica issue get <id> --output json` and `multica issue comment list <id> --output json`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single parent issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `multica issue create --title "..." --description-file <path>`, then attach the label with `multica issue label add`.
- **Child ticket**: `multica issue create --parent <map> --title "..." --description-file <path>`. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev. List a map's children with `multica issue children <map> --output json`.
- **Labels**: the `wayfinder:*` labels don't exist in Multica yet. Create each on first use with `multica label create --name "wayfinder:map" --color "#3b82f6"`, then attach it by ID.
- **Blocking**: Multica has no dependency edges. Put a `Blocked by: ISSUE-n, ISSUE-n` line at the top of the child body. A ticket is unblocked when every blocker is `done`. Use `--stage <N>` only when the ordering is a strict sequence of groups: a stage's tickets all finish before the parent is woken, which doesn't express per-ticket blockers.
- **Frontier query**: `multica issue children <map> --output json`, drop any that is `done` or `cancelled`, assigned, or has a `Blocked by` blocker that isn't `done`; first in map order wins.
- **Claim**: `multica issue assign <n> --to <your-name> --no-start`, the session's first write.
- **Resolve**: `multica issue comment add <n> --content-file <path>` with the answer, then `multica issue status <n> done`, then append a context pointer (gist + link) to the map's Decisions-so-far.
