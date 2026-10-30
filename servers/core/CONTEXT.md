# Core service — context

The NestJS + Bun HTTP server. Identity through Better Auth, Drizzle over PostgreSQL,
one Nest module per thing the service owns.

## Modules

A module is named after the question it answers, not the layer it sits in — `directory`
and `notification`, never `controllers` and `services`. The layers are _inside_ each
module, described below.

| Module           | Owns                                                                           |
| ---------------- | ------------------------------------------------------------------------------ |
| `auth`           | Better Auth's configuration, its generated `auth` schema, and the hooks on it. |
| `access-control` | Business permissions, roles, scoped assignments, decisions and break-glass.    |
| `audit`          | `AuditTrail`. The only writer of `auth_audit_event`.                           |
| `directory`      | The group as an admin sees it: positions and privileged access reviews.        |
| `notification`   | Wording, the queue, delivery and suppression, on three channels.               |

## Layers inside a module

`access-control`, `audit`, `directory` and `notification` each hold four directories. The dependencies point
one way only, inwards:

| Layer             | Holds                                                        | May import        |
| ----------------- | ------------------------------------------------------------ | ----------------- |
| `domain/`         | Entities, value objects, pure rules, repository _interfaces_ | nothing else here |
| `application/`    | Use cases, one per operation; DTOs; the module's façade      | `domain/`         |
| `infrastructure/` | Drizzle repositories, provider adapters, config, schedulers  | both above        |
| `presentation/`   | Controllers: routing, roles, paths                           | `application/`    |

A port is an interface in `domain/` (or `application/ports/`) plus a `Symbol` token. Every
port is bound to its adapter in the module's `*.module.ts` and nowhere else, which is the
only file that decides the store is Postgres and the carriers are Resend, Twilio and Meta.

`auth` is deliberately **not** layered. Better Auth owns the identity model and
`bun run auth:schema` regenerates its schema wholesale, so a hand-written entity beside it
would be a second model a generator can silently invalidate. See ADR-0003.

Three things about the shape are worth knowing before adding to it:

- **A module exports one token, not its classes.** `notification` exports
  `NOTIFICATION_SENDER`; `audit` exports `AUDIT_TRAIL`. A caller depends on the interface,
  so the day a module becomes its own service an HTTP or queue client is bound to the same
  token and no caller changes. Reaching past a façade into another module's use cases,
  entities or tables is the thing this arrangement exists to prevent.
- **Read and write are separate ports.** A repository loads and saves one aggregate and
  answers in entities. `NotificationQuery` filters, facets, counts and pages in the database
  and answers in rows. Keeping them apart is what stops the admin surface's paging being
  dragged through a domain model — and what would let the two be served by different stores.
- **Several tables changed as one act go through a unit of work.**
  `NotificationUnitOfWork.transaction()` hands the use case repositories already bound to
  the open transaction, so the application layer can open one without learning what a
  `Database` is. The repositories are the same classes bound outside a transaction; only the
  executor differs.

## Vocabulary

- **Subsidiary** — one company of the group: Better Auth's `organization`, the tenant. A
  person belongs to it through a **member** record. Users cannot create one and it is not
  deletable. Access assigned at this scope reaches every team under it.
- **Team** — a subdivision of one subsidiary, joined through a **team member** record. It is
  never a tenant of its own and there is no default team. A person's teams, by name, decide
  which domains they see. Access assigned at this scope reaches only the team.
- **Group** — every subsidiary and team together. The thing an admin administers, as
  opposed to a single **subsidiary** or a **team** inside one.
- **Group directory** (`GroupDirectory`) — the read of the whole group that Better Auth's
  own endpoints refuse, because they answer as the signed-in member and an admin's job is
  the teams they are not in.
- **Admin dashboard** (`AdminDashboard`) — the read model behind `apps/admin`'s front page,
  and the access review taken from it. Its rules are pure functions in the same file:
  `attentionFor`, `privilegedAccess`, `timeline`, `startOfReviewWeek`.
- **Attention** — a fact about a person an operator should act on: a temporary password
  still unchanged, an address unverified for a week, membership of no subsidiary. A banned
  account raises none; it is already the answer.
- **HR record** — a Frappe HR Employee, the record of who works here. It drives two things
  only: an ordinary account for an active employee who has none, and offboarding on the
  relieving date of one who has left. See ADR 0004.
- **Employee link** (`hr.employee_account`) — which account belongs to which HR record, by
  Frappe's employee id rather than by address. One record, one account, both ways.
- **Access review** — an operator's weekly confirmation that one privileged account is still
  intentional. Stale when the person's auth row has changed since, so a role edit returns
  them to the queue. The week starts Monday, UTC.
- **Permission** — a code-owned action such as `domain:administer`. Permission keys are
  deployed with the resource they protect; an operator cannot invent one in the database.
- **Access role** — a named bundle of business permissions. It is separate from Better
  Auth's identity roles, which decide who may operate the back office itself.
- **Access assignment** — one person's access role at subsidiary or team scope. A
  subsidiary assignment reaches its child teams; a team assignment is narrow. The row is
  retained when it expires, is revoked, loses membership, or no longer meets MFA policy,
  but no longer grants access. Membership deletion and suspension revoke business grants
  atomically through access-control-owned database triggers. Rejoining never revives them.
- **Position** — a descriptive title and optional reporting manager at group or subsidiary
  scope. Positions explain the company hierarchy and never grant permissions.
- **Break-glass elevation** — a super-admin's short, session-bound emergency grant for one
  permission and scope, with a reason. It expires after 15 minutes and every use is audited.
- **Trusted origin** — the browser origin allowed to make cookie-authenticated writes.
  Better Auth enforces its own routes; Nest's `enableCsrfProtection()` (in `application.ts`)
  applies the same configured allowlist to every other route. Signed notification webhooks
  remain at their signature boundary.
- **Audit trail** (`AuditTrail`) — who did what to whose access. It has a module of its own
  because it has two writers, `auth` and `directory`, and neither should hold the other's
  table. Callers hand over the fact; the id and the timestamp are the trail's.
- **Wording** — a `notification.template` row. Versioned and published rather than edited in
  place, so correcting a typo never rewrites what someone already received.
- **Message** — one row in `notification.message`, which is both the queue and the log.
  Inserted in the caller's transaction; delivered later by the **dispatcher**. Its `payload`
  is rendered at enqueue and kept forever, so anything the wording declares a **secret**
  stays in it as a `{{name}}` placeholder and its value waits in `secrets` instead — cleared
  by the same statement that marks the message sent, suppressed or finally failed. The
  carrier reassembles the real text in memory; a row whose secrets are gone refuses to be
  sent again rather than deliver a literal placeholder.
- **Suppression** — a destination the workspace has stopped writing to, and why. Checked at
  enqueue and again at send.
- **Secret** — a template variable whose value must never be written down: `password`, on
  the two account templates. Declared on the **wording**, so a template carries its own
  hazard rather than the code guessing at one, and carried forward when that wording is
  edited.
- **Channel** — email, SMS or WhatsApp. Each has a **carrier** (Resend, Twilio, Meta) and is
  **configured** only when this deployment holds its credentials. A configured channel really
  sends, in every environment; an unconfigured one writes to the log, which the admin surface
  says out loud — except in production, where it fails instead, because a message that
  quietly went nowhere is worse than one that failed.
- **Carrier** (`MessageCarrier`) — whoever actually takes a message out of the building.
  The one port here with more than one real implementation, which is what makes it a seam
  rather than an abstraction: Resend, Twilio, Meta and a console sender that stands in for
  whichever of them this deployment has no credentials for.
- **Dispatcher** — the timer, and only the timer. What a pass _does_ is `DrainQueueUseCase`;
  when a pass happens is a fact about this deployment. `NOTIFICATION_WORKER=0` turns it off,
  so moving it to its own process is a second entrypoint calling the same use case, and
  `for update skip locked` already makes two of them safe.

## Authorization changes

For new or changed API routes, follow [authorization declarations and denial tests](../../docs/agents/authorization.md). Undeclared Nest routes fail closed. Recovery, lifecycle and privileged-review procedures are in [access operations](../../docs/security/access-operations.md).

## Collections

Every listing route answers with ADR-0002's **collection**: `data`, `meta` and `links`.

- **Facet** — a filterable column whose values are also counted, so the surface can show
  what each option it is _not_ showing would give. A facet's own selection is left out of
  its own counts and applied to every other facet's; the search narrows everything.
- **`collectionOver(table, spec)`** in `shared/database/collection.ts` — declare a table's
  searchable columns, sortable columns and facets once, and `page()` does the rest. A new
  listing route is a declaration, not ninety lines of query shaping. Its rule is verified in
  `test/integration/collection.integration.ts`, against Postgres, because SQL semantics are
  the thing being asserted.
- **`pageCollection(rows, …)`** in `shared/http/collection.ts` — the same contract over an
  array already in memory. What the directory routes use, since their rows are assembled
  from several tables rather than read from one.

## Where the tables live

`schema.registry.ts` re-exports every module's Drizzle schema, and `drizzle.config.ts`
points at it. The Postgres schema name and the Nest module need not match: `audit` owns
`auth_audit_event`, which stays in the `directory` Postgres schema where it was created.

`auth/operations.schema.ts` owns verified factor-recovery requests in the separate
`identity_operations` schema; it is hand-owned and is never a schema-generator target.

`auth`'s schema file is generated wholesale by `bun run auth:schema`. Never hand-edit it,
and never add a column to it — anything of ours goes in a schema we own.
