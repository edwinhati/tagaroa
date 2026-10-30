# Playwright regressions and e2e exploration

## Local results, 9 October 2026

| Suite                                         | Result                                                | Local evidence                                        |
| --------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Auth browser matrix                           | 27 passed                                             | `/tmp/tagaroa-playwright-complete.log`                |
| Final admin browser matrix                    | 64 passed, 2 intentional heap skips                   | `/tmp/tagaroa-playwright-admin-final.log`             |
| Session, permission and delivery follow-up    | 9 passed                                              | `/tmp/tagaroa-final-focused.log`                      |
| Reload readiness and uncaught-error follow-up | 6 passed, two repeats per project                     | `/tmp/tagaroa-role-reload-fixed.log`                  |
| Model-free e2e                                | 3 passed per target: admin, auth, workspace           | `/tmp/tagaroa-exploration-{admin,auth,workspace}.log` |
| Backend integration                           | 39 passed, 1,276 assertions                           | `/tmp/tagaroa-exploration-integration.log`            |
| Unit tests                                    | 187 passed                                            | `/tmp/tagaroa-exploration-units-final.log`            |
| Type checks                                   | 9 workspace tasks and strict exploration check passed | `/tmp/tagaroa-exploration-types-final.log`            |
| Lint and builds                               | Passed; 5 build tasks                                 | `/tmp/tagaroa-exploration-{lint,build}-final.log`     |

The browser matrix represents 31 workflow definitions, 93 registered checks and
91 passes. The reload scenario was subsequently strengthened with a browser-error
assertion and waits for hydrated controls, then rerun twice on every project.
No retry was needed in the successful local runs. AI exploration was not run:
the CLI correctly refuses the absent model with exit code 2. Invalid targets and
occupied QA ports are refused, and all QA ports were released after testing.
Hosted CI has not run.

### Changes found through testing

- Reviewers and helpdesk users could see team membership controls after the
  roster loaded. `canManage` now reaches each team row and gates add/remove.
  The regression waits for the roster before checking absence, preventing an
  early-loading false pass.
- Mobile delivery rows now have the same explicit “View … to …” accessible name
  as desktop controls.
- Rapid test reloads canceled TanStack's development entry before hydration.
  Person workflows now wait for loaded controls and assert no uncaught errors.
- Notification fixtures pass objects to Bun SQL rather than JSON strings; a SQL
  assertion verifies the rendered body exists before exercising the UI.
- The root Playwright command serializes suites that share the seeded operator.

## Run the regression suite

```sh
bun run test:e2e
bun run test:e2e --project=chromium
bun run test:integration
```

The root Playwright command runs auth, then admin. Both suites share the QA
operator and database, so do not run them concurrently with each other or with
exploration. The default browser matrix is Chromium, WebKit and mobile Chromium.
Firefox remains available as an explicit project but is not in the default matrix.

[The scenario map](scenario-map-2026-10-09.md) lists the browser workflows.
Backend integration tests retain exact timing, queue, signature, scope and load
assertions. Those checks complement the browser suite rather than being replaced
by agent judgments.

## Watch tests and exploration

Tests normally run headless. From the repository root, watch the auth and admin
Playwright suites run sequentially in Chromium:

```sh
bun run test:e2e:headed
```

For Playwright's interactive test picker, run one app at a time:

```sh
cd apps/admin # or apps/auth, from the repository root
bun run test:e2e:ui
```

From the repository root, watch the exploration agent in a visible browser:

```sh
QA_EXPLORATION_TARGET=admin bun run explore:headed --target admin --session operator --max-steps 1 'Open Subsidiaries and inspect the create dialog. Cancel without saving.'
```

Playwright UI lets you select tests and inspect their steps. Headed exploration
shows the browser while the agent works; reports remain under `.e2e/`.
To watch the model-free e2e checks, use `bun run test:exploration --headed`.
Run these commands separately because they share QA ports and fixtures.
A visible browser does not resolve the local model's planning timeouts.

## Verify the exploration runner without a model

```sh
bun run test:exploration
QA_EXPLORATION_TARGET=auth bun run test:exploration
QA_EXPLORATION_TARGET=workspace bun run test:exploration
```

Each run starts core, auth, workspace and admin on the isolated QA ports
18080/13001/13002/13003 and refuses occupied ports. It prepares `tagaroa_test`,
replaces the seeded operator, grants that fixture the super-admin role, signs in,
and verifies real TOTP enrollment. The saved `operator` session is encrypted by
e2e and lasts for that run. This setup uses local fixture credentials; it never
needs a production account. Set `TEST_DATABASE_URL` only to a disposable QA database.

The model-free checks cover signed-out entry, session setup and restoration.
They do not perform exploratory testing. Reports and traces are under `.e2e/`,
which is ignored by Git. Video is off. The package scripts disable telemetry.

## Exploration commands with local Qwen

`e2e.config.ts` connects the built-in e2e agent to the same local server used by
`pi --provider mlx --model /Users/edwinhati/Models/Qwen3.5-9B-MLX-4bit`:
`http://127.0.0.1:8081/v1`, with that exact model ID. Pi itself is not launched
by e2e. The connection uses the framework's supported
[OpenAI-compatible provider](https://e2e.tester.army/docs/models), without cloud
credentials. Keep the MLX server running before exploration:

```sh
mlx_lm.server --model /Users/edwinhati/Models/Qwen3.5-9B-MLX-4bit --host 127.0.0.1 --port 8081
```

The installed `mlx_lm.server` accepts text and tool calls but rejects image
content. DOM-based exploration can use this server; screenshot interpretation
requires a vision-capable server. A run that fails on image input is a model
capability failure, not a confirmed product defect. The model-free CI checks
do not call this local endpoint.

Thinking is disabled through `chat_template_kwargs.enable_thinking` for bounded
browser actions. With thinking enabled, the first local attempt timed out before
an action. With it disabled, a one-step smoke run completed in 35 seconds and
clicked “Show password”, observing “Hide password”. Its planner and closing
assessment returned invalid structured output, so e2e used its fallback survey.
The passing run establishes local model tool calls, not reliable autonomous
planning or visual coverage. The server does not enforce JSON schemas.
The longer three-step follow-up performed two actions but its fallback survey
exceeded the action timeout. Local inference latency is also a current limit;
start with one-step goals and inspect the report rather than treating a run's
exit status as proof the requested goal was covered.

```sh
bun run explore --session operator --max-steps 8 'Explore subsidiary and team membership: create a QA subsidiary and team, add and remove a QA account, cancel confirmations, reload, and report lost edits or incorrect membership. Only mutate records created during this exploration.'
bun run explore --session operator --max-steps 8 'Explore business roles, scoped assignments and emergency access. Check disabled actions, required fields, cancellation, reload and reauthentication. Only mutate records created during this exploration.'
bun run explore --session operator --max-steps 8 'Explore notification overview, delivery filters, message details, template drafts and suppressions. Check empty states, keyboard navigation, cancellation and reload. Do not send notifications or lift existing suppressions.'
QA_EXPLORATION_TARGET=workspace bun run explore --session operator --target workspace --max-steps 8 'Explore account settings, profile, security and sessions with keyboard navigation. Check dialog focus, error messages and reload. Do not change the operator password, disable MFA or revoke the active session.'
QA_EXPLORATION_TARGET=auth bun run explore --target auth --max-steps 8 'Explore sign-in validation, password visibility, locked-out guidance and keyboard navigation without signing in. Report broken controls, inaccessible messages and layout problems.'
```

Run one target at a time. Each command gets a fresh stack and operator.
Use a new QA record for destructive scenarios. A suspected defect becomes a
Playwright regression with a precise assertion before it is considered confirmed.
The [explore documentation](https://e2e.tester.army/docs/explore) describes budgets,
reports and exit codes. AI exploration is optional and is not a merge gate;
the model-free smoke checks run in the Chromium CI job.

## Checks still requiring an environment or person

Physical passkeys and deployed HTTPS remain deferred. Native screen readers,
physical mobile keyboards, actual browser zoom, real notification providers,
production capacity and GitHub-hosted execution are not established by local
Playwright or model-free e2e checks.
