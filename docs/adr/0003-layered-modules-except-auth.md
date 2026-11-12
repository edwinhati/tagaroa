# 3. Layered modules, except auth

Date: 2026-08-30

## Status

Accepted

## Context

`servers/core` was already a modular monolith: one Nest module per thing the
service owns, named after the question it answers rather than the layer it sits
in. What it lacked was a seam between the HTTP surface and the database. Every
module holding `DATABASE` had no unit tests at all, because exercising its rules
meant booting Nest with an admin session and a Postgres instance; every module
without it had them.

Two shapes were considered for closing that. Ports and adapters — repository
interfaces with DI tokens, plain domain types, one service per aggregate — and
full clean architecture, adding entities with private constructors, explicit
mappers, a use-case class per operation, and DTOs at each boundary.

The second costs roughly forty-five more files. Its return is not test isolation,
which both give: it is that invariants become structural rather than incidental,
and that a use-case vocabulary reads as a feature list. A suppressed message
carries `suppressed`, a reason and a completion time — all three or none — and
before this that held only because a single insert statement happened to set them
together.

`auth` is a different case. Better Auth owns the identity model and
`bun run auth:schema` rewrites its schema file wholesale. A hand-written `Person`
entity plus a mapper would be a second model of the same data, kept in step by
hand, that a code generator can silently invalidate on a schedule. That is a
correctness hazard rather than extra work.

## Decision

`audit`, `directory` and `notification` are layered: `domain/`, `application/`,
`infrastructure/`, `presentation/`, with dependencies pointing inwards only.
Repository interfaces and their `Symbol` tokens live in `domain/`; every port is
bound to an adapter in the module's `*.module.ts` and nowhere else.

`auth` is not layered. It keeps its generated schema, its configuration and its
hooks, and it reaches other modules only through their façades.

A module exports one token, not its classes — `NOTIFICATION_SENDER`,
`AUDIT_TRAIL`. Cross-module calls go through that interface, never through
another module's use cases, entities or tables.

Reads and writes get separate ports where the shapes differ. A repository loads
and saves one aggregate and answers in entities; a query port filters, facets,
counts and pages in the database and answers in rows.

Several tables changed as one act go through a unit of work, which hands the use
case repositories already bound to the open transaction. The application layer
never holds a driver transaction object.

## Consequences

- A new module follows the four directories. A new operation is a use case, not a
  method added to a growing service.
- Domain rules are testable without Nest, a session or Postgres. Unit tests rose
  from 47 to 72 while the HTTP contract did not change.
- Cross-module foreign keys into `auth.user` remain. They are the real blocker to
  extracting a module into its own service, and replacing them with bare ids
  would trade working `on delete` integrity for a move nobody has committed to.
  That belongs in the migration that precedes an extraction, not before it.
- Two casts are accepted and documented: Drizzle's builder generics cannot follow
  a table passed as a parameter (`platform/database/collection.ts`), and its
  transaction handle carries the same query builders as the database without
  sharing its type (`drizzle-notification.unit-of-work.ts`).
- If Better Auth is ever replaced by something we own, `auth` is re-examined
  under this ADR rather than exempted by it.
