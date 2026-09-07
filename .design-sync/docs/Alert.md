---
category: Feedback
---

A static, inline message calling out something the person should notice.

**Parts** (same import, compose inside `Alert`): `AlertAction`, `AlertDescription`, `AlertTitle`

**Variants:** `default` · `destructive`

There are no status variants. The `--status-*` triplets described in `Badge` ship as tokens
only; to tint an alert, keep `variant="default"` and apply them by class.
