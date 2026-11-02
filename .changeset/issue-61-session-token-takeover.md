---
"@servers/core": patch
"@apps/admin": patch
"@apps/auth": patch
---

ISSUE-61: Session listings no longer return session tokens, and only a signed bearer token is accepted. Only a super administrator can list or revoke a privileged account's sessions. Revoking a single session now goes through core by session id and is recorded in the audit trail.
