---
"@servers/core": minor
---

ISSUE-126: Tagaroa is an OIDC provider, so NetBird (and later other first-party apps) can sign people in with their Tagaroa account. The issuer is `<BETTER_AUTH_URL>/api/auth`; ID tokens are RS256 and carry email and name. Someone still on a temporary password, or a privileged role without MFA, is held at the sign-in page until they finish onboarding. Clients are registered by an operator with `scripts/oauth-client.ts`, never over HTTP. Production needs the new `SIGN_IN_URL` (the door).
