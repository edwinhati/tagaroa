---
category: Data display
---

A small status or count label attached to something else.

**Variants:** `default` · `secondary` · `destructive` · `outline` · `ghost` · `link`

There are no status variants. Fifteen `--status-*-{tint,line,text}` triplets ship in
`tagaroa.css` (`neutral`, `info`, `success`, `warning`, `danger`, exposed to Tailwind as
`bg-status-success-tint`, `text-status-success-text`, and so on), but no component consumes
them yet. For a status pill today, use `outline` or `ghost` and apply the triplet:

```jsx
<Badge variant="outline" className="bg-status-success-tint border-status-success-line text-status-success-text">
  Active
</Badge>
```

Prefer a shipped triplet over inventing a colour: `neutral` for draft, inherited, revoked,
queued; `info` for invited, in review, sending; `success` for active, granted, delivered,
current; `warning` for temporary password, expiring, emergency live, MFA stale; `danger` for
suspended, locked, failed.
