---
"@apps/admin": patch
"@apps/auth": patch
"@apps/workspace": patch
"@domains/engineering": patch
"@repo/contracts": minor
"@repo/shell": minor
---

Leaving a page while it is still checking your session no longer sends you to the sign-in page instead of where you were going (seen in Firefox).

- When the sign-in service can't be reached, apps now show "This page didn't load" with a Try again button, instead of sending you to the sign-in page. Only a real "you're signed out" goes to sign-in.
- Passkey and session errors in account settings show a readable sentence instead of the browser's raw network error.
- Offboarding sends only the reason it asks for.
