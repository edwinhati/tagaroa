---
"@apps/admin": patch
"@servers/core": patch
---

ISSUE-65: The audit trail now records notification template changes, lifted suppressions, single-session revocation, the end of impersonation, and subsidiary and team edits. Direct organization writes that bypassed the trail (invitations, member roles, team creation) are refused.
