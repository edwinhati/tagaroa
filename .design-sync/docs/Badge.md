---
category: Data display
---

A small status or count label attached to something else.

**Variants:** `default` · `secondary` · `destructive` · `outline` · `ghost` · `link`

**Status is a data attribute, not a variant.** Set `data-status` to one of five values and the
badge takes that triplet's tint, line and text from `tagaroa.css`:

```jsx
<Badge data-status="success" variant="outline">
  Active
</Badge>
```

Map every product state to one of the five; never invent a sixth colour, and never use
`default` / `secondary` / `destructive` to mean a state. `neutral` for draft, inherited, revoked,
queued; `info` for invited, in review, sending; `success` for active, granted, delivered,
current; `warning` for temporary password, expiring, emergency live, MFA stale; `danger` for
suspended, locked, failed.

Plain variants are for counts and categories ("3 pending", "Platform"), not state.
