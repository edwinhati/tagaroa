---
"@servers/core": patch
---

Refuse provider webhooks when their signing secret is empty or a bare `whsec_`, which previously let anyone forge a Resend, Twilio or WhatsApp receipt (and raise a suppression on any address); read settings only from the validated environment; and let a notification or HR pass already under way finish before shutdown closes the database pool, so a deploy no longer sends a message twice.
