---
"@servers/core": patch
"@apps/auth": patch
---

ISSUE-130: Signing out of NetBird no longer stops on Better Auth's bare "Confirm logout" page, whose Confirm always failed in production. When core can't tie the sign-out to this browser's session, it sends the person to a sign-out page in the door instead, with the app and its registered return address sealed in the link; the door signs them out and takes them back to the app.
