---
"@servers/core": patch
---

ISSUE-82: Adding someone who is already a member of a subsidiary now answers 409, including when two requests race, and the database allows one membership per person per subsidiary.
