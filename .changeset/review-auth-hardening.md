---
"@servers/core": patch
---

Close account-security gaps found in review:

- A refused password reissue no longer emails the person a "password reset" carrying the caller's text.
- `/admin/update-user` changes only name, email, personal email and role; second-factor and temporary-password state are refused.
- Bearer-authenticated admin and subsidiary requests now get the same policy as cookie sessions.
- An expired temporary password is refused at sign-in and at password change, with or without a second factor, and leaves no session behind.
- The database keeps one active super administrator when two are suspended, demoted or deleted at once.
- An impersonated session can no longer write through any core route outside `/api/auth`.
- Reissuing a password ends every session the person holds, on the server.
- Impersonating someone no longer signs them out of one of their own devices.
- A display name containing `{{word}}` no longer makes that person's email unsendable.
