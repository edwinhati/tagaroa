---
"@servers/core": patch
---

ISSUE-50: The Frappe HR and notification (Resend, Twilio, Meta) webhooks now validate their payloads with Zod after the signature check. Valid and ignored events are unchanged; a signed payload missing or mistyping a field the receipt parsers read returns the standard 400 with `message` and `details`. Unsigned or altered bodies are still a 401, before any parsing.
