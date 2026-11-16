---
"@servers/core": patch
---

ISSUE-129: Signing out of NetBird no longer stops at "The client is not allowed to initiate logout". OAuth clients are registered with end session enabled, and `scripts/oauth-client.ts ... --logout <uri>` registers where the app may send people after they sign out (NetBird: `https://vpn.tagaroa.cc/oauth2/logout/callback`).
