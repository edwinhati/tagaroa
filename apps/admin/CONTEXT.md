# Admin app

The back office where authorized staff manage group-wide identity and subsidiary membership. It remains Tagaroa-owned even when Better Auth supplies the underlying identity operations.

## Language

**Operator**:
The signed-in administrator performing an action in the back office.
_Avoid_: Current user, dashboard user

**Person**:
The employee whose identity, access, and sessions an operator is reviewing.
_Avoid_: Row, record, account

**Person details**:
The focused view of one person's standing, access, and active sessions.
_Avoid_: User dashboard, profile

**Impersonation**:
A temporary session in which a super-admin enters the workspace as another person to diagnose access problems.
The impersonated session may read and stop impersonating; every write, the back office's
included, is refused until the operator is back in their own account. A persistent notice
says so for as long as it lasts.
_Avoid_: Login as, switch user

**Identity administration**:
Group-wide management of people, sign-in roles, suspensions, credentials, and sessions.
_Avoid_: Dashboard, control plane

**Identity & access**:
The operator area for daily identity work. Its work queue, People directory, business access,
privileged access, reviews and activity are organized by task rather than by
the underlying authentication module.
Its canonical routes live under `/identity-access`; notifications and subsidiaries remain
separate top-level admin areas.
_Avoid_: Auth section, security dashboard

**Subsidiary**:
One company of the group, and the tenant. A person belongs to it through membership; operators
cannot delete one. Access assigned at subsidiary scope reaches every team under it.
_Avoid_: Organization, company, tenant

**Team**:
A subdivision of one subsidiary, never a tenant of its own. A person sees the domains their
teams are bound to; a team's name decides nothing. Access assigned at team scope reaches only
that team.
_Avoid_: Department, group

**Domain binding**:
The one working domain a team opens, chosen by an operator from Subsidiaries, or none. It
is what puts a domain in a team member's workspace.
_Avoid_: Team name, domain membership

**Business access**:
Permission to act on company resources, expressed as code-owned permissions bundled into
custom access roles and assigned at subsidiary or team scope.
_Avoid_: Auth role, title

**Position**:
A descriptive job title and optional reporting manager at group or subsidiary scope. A
position explains the hierarchy; it never grants access.
_Avoid_: Permission, access role

**Emergency access**:
A super-admin's 15-minute, session-bound grant for one permission and scope, recorded with
a reason and audited on use. The core service calls it break-glass elevation.
_Avoid_: Permanent override, admin bypass

**Access review**:
An operator's confirmation that a grant is still intentional, week by week. Privileged access
is reviewed per person, by identity role; business access per assignment or emergency grant
(once), and may be flagged instead of confirmed, never by its holder or its grantor. Both
return to the queue when what was reviewed changes.
_Avoid_: Audit, approval

**Notifications**:
The operator area for the workspace's outgoing email, SMS and WhatsApp: wording (templates),
delivery, and suppressions. Its routes live under `/notifications`.
_Avoid_: Messaging, email settings

The canonical person view is the route-backed Person workspace. Links may preserve the
People directory's search, filters, sort, and page so returning restores the operator's
working context.

- **Personal address** — where an operator sends a person's onboarding message or a reissued
  password. Prompted for when issuing an account, editable from Person details, and shown in
  the reissue dialog so an operator sees the destination before acting. Avoid "email" alone
  on this surface: a person has two, and only one of them the workspace ever writes to.
