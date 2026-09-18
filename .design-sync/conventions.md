# Building with the Tagaroa design system

**Quiet work on warm ground.** Tagaroa is a calm ops product for staff: accounts, access, reviews,
notifications. Warm bone page, one lifted work surface per region, ink-filled primary actions, and
a single sea accent that only appears where the keyboard is. Compact controls (~28px).

Components come from `window.TagaroaUI` as **flat named exports**: `Card`, `CardHeader`,
`DropdownMenuItem`. There is no dot notation, so `Card.Header` does not exist.

## Taste: what makes a screen Tagaroa and not a template

Read this before composing anything. A screen that breaks these looks generic no matter how
clean the markup is.

**Content is the design.**
- Use real, specific content: named people, IDs, dates, consequences. "Bram de Vries · invited
  2 days ago, not yet accepted", not "John Doe · Lorem ipsum". "2 people keep access through
  Platform", not "Some users affected".
- No greetings ("Good morning, …"), no upsell cards, no illustrations, no emoji.
- **No opening row of stat cards.** A number earns a place only when it answers a question the
  screen is for. Write it as a sentence with its context: "3 of 12 reviews overdue".
- Buttons name the outcome ("Suspend account", "Approve access"), never "Submit" or "OK".
- Empty, loading and error states name the cause and the next action.

**Every screen fits one of five patterns.**
- **Register:** a table inside one work surface, tabular counts, one primary action, the row is
  the link.
- **Object detail:** breadcrumb, the object's name, a status chip, mono meta (ID, created), tabs
  for that one object.
- **Review queue:** the default filter is "needs a person"; approve is the default action;
  refusing asks for a reason.
- **Console:** list on the left, detail on the right; payloads in mono; retry is `outline`.
- **Administration:** a form no wider than ~576px; scope shows what it inherits; a privileged
  change asks for a reason.

**The named rules.**
- **Panel Rule.** One lifted work surface (`Card`) per major region. Tables, lists and forms live
  inside it, separated by hairlines. Never nest a card in a card, never tile a row of equal cards,
  never put content in gray washes (`bg-muted/40` panels). Sidebars, toolbars and filter rows stay
  flat.
- **Keyboard Rule.** Sea is for focus rings, the caret, selection and hovered links only. Never a
  button fill, a badge, a chart series or decoration.
- **Chromatic Rule.** Primary buttons are ink (`variant="default"`), never blue. State uses the
  five status triplets (see Badge). No category rainbows (Design / Frontend / Backend chips in
  different colours).
- **Small Control Rule.** Controls stay small (~28px, `size="sm"` in chrome). If something needs to
  be noticed, add space around it; don't make the box bigger. Sections are separated by ~24px
  (`gap-6`).
- **Type.** Geist for reading. Mono (`font-mono`) only for literal strings: IDs, keys, emails,
  destinations. Counts and times stay sans with tabular figures
  (`style={{ fontVariantNumeric: "tabular-nums" }}`). Uppercase only for table column headers.
  Secondary lines recede with `text-muted-foreground`, not with a different size.
- **Two-line cells.** Lists and tables carry a primary line and a muted secondary line
  ("Ada Okonkwo" / "Platform · signed in 4 min ago"). Density comes from information, not from
  shrinking type.

## Setup

No provider is required. Every component is styled by CSS classes and `data-` attributes, and
nothing in the library reads React context for its theme — drop a `Button` on a bare page and it
is correct.

Three components do own context, and each supplies its own: `SidebarProvider` (wrap a `Sidebar`),
`ChartContainer` (wrap a chart), `TooltipProvider` (optional, for shared delay).

**Themes** are a class on the root element: nothing for light, `dark` for dark. Both palettes
ship. `ThemeProvider` + `ThemeToggle` (from `@repo/ui/blocks/theme`) exist for letting a person
switch, and `themeBootScript` is an inline script that applies the stored choice before first
paint — use them for a real app shell, skip them for a single screen.

## The styling idiom

Tailwind v4 utilities whose color, radius and type values are bound to CSS custom properties.
Style with utilities; never hardcode a hex.

**The stylesheet is precompiled and closed.** It contains the ~1,600 classes this library
actually uses — not all of Tailwind. A class that looks perfectly ordinary may emit nothing:
`bg-accent`, `bg-destructive`, `ring-ring` and `h-32` are all absent. Worse, an absent class is
not inert — these components merge classes through `tailwind-merge`, so passing `w-40` to a
component can **evict its own working width** and leave it unstyled.

So, in order:

1. **Prefer the component's own props.** `variant`, `size` and friends always work. This covers
   most of what you need.
2. **For layout glue, use classes from the list below** — these are verified present.
   Arbitrary values never compile here — `text-[13px]`, `rounded-[10px]`, `w-[200px]` and the
   like emit nothing, because nothing scanned at build time contained them. Use a named class
   from the table, or step 3.
3. **For anything else, use an inline `style` with a token**: `style={{ background: "var(--muted)" }}`.
   All 75 tokens are defined even where a matching utility class was never generated. This always
   works and cannot be evicted.

### Verified-present utilities

| Family    | Values                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface   | `bg-background` `bg-card` `bg-popover` `bg-muted` `bg-muted/50` `bg-primary` `bg-secondary` `bg-sidebar` `bg-foreground` `bg-input` `bg-transparent` `bg-destructive/10`                             |
| Text      | `text-foreground` `text-muted-foreground` `text-primary` `text-primary-foreground` `text-secondary-foreground` `text-card-foreground` `text-popover-foreground` `text-destructive` `text-background` |
| Type      | `text-xs` `text-sm` `text-base` `text-lg` · `font-sans` `font-mono` `font-heading` · `font-normal` `font-medium` `font-semibold`                                                                     |
| Border    | `border-border` `border-input` `border-primary` `border-transparent` · `border-b` `border-t` `border-l` `border-r` `border-y` `border-dashed`                                                        |
| Radius    | `rounded-sm` `rounded-md` `rounded-lg` `rounded-xl` `rounded-2xl` `rounded-full` `rounded-none`                                                                                                      |
| Space     | `p-{0,1,2,3,4,6,10,12}` · `px-{0,1,1.5,2,2.5,3,4}` · `py-{0.5,1,1.5,2,2.5,3,4,6,12}` · `gap-{0,0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8}`                                                                     |
| Size      | `size-{2,3,4,5,6,7,8,9,10,16,full}` · `w-{2,4,5,10,24,48,56,64,72,80,full,fit,auto,max}` · `h-{2,4,5,6,7,8,9,10,12,24,40,64,auto}` · `max-w-{xs,sm,md,lg,xl,80,full}`                                |
| Layout    | `flex` `flex-col` `flex-row` `flex-wrap` `flex-1` · `grid` · `items-{start,center,end,stretch}` · `justify-{start,center,between}`                                                                   |
| Elevation | `shadow-{xs,sm,md,lg,xl,none}` · `ring-{0,1,2,3}` `ring-ring/50`                                                                                                                                     |

### Tokens

Color: `--background` `--foreground` `--card` `--card-foreground` `--popover`
`--popover-foreground` `--primary` `--primary-foreground` `--secondary`
`--secondary-foreground` `--muted` `--muted-foreground` `--accent` `--accent-foreground`
`--destructive` `--border` `--input` `--ring` `--sea` · status
`--status-{neutral,info,success,warning,danger}-{tint,line,text}` · charts `--chart-1` … `--chart-5` ·
sidebar `--sidebar` `--sidebar-foreground` `--sidebar-accent` `--sidebar-accent-foreground`
`--sidebar-border` `--sidebar-primary` `--sidebar-ring`.

Other: `--radius` `--panel-radius` `--panel-shadow` `--control-height` `--font-sans` `--font-mono`.

`--sea` is the one accent, a blue-green ink, and what `--ring` resolves to. It belongs to the
keyboard only (see the Keyboard Rule). Status chips use the five `--status-*` triplets through
`data-status` on `Badge`.

## Composition rules that matter

- **One work surface.** `Card` is the lifted surface (`bg-card`, thin border, soft shadow, 12px
  radius). Put a table or list in it with `className="p-0 gap-0"` so rows run edge to edge. The
  section title sits above the card, not inside it. `Item` is the workhorse row.
- **Status chips.** `<Badge data-status="success" variant="outline">Active</Badge>`. Values:
  `neutral`, `info`, `success`, `warning`, `danger`. The `bg-status-*` utility classes are **not**
  in the sheet; `data-status` is the only way.
- **Section titles** are sentence-case (`text-sm font-medium`). Reserve uppercase COLUMN
  labels for table headers only.
- **Menu labels need a group wrapper.** `DropdownMenuLabel`, `ContextMenuLabel` and `MenubarLabel`
  throw at render time unless wrapped in the matching `DropdownMenuGroup` / `ContextMenuGroup` /
  `MenubarGroup`. The failure is a blank component, not an error message.
- **Tables**: `Table` is the bare primitive — header hairline, row hover, no per-row borders.
  Anything sortable, filterable, selectable or paginated is `DataTableView` with `useDataTable`
  — it brings the toolbar, faceted filters, column visibility, pagination and CSV export.
- **Chat**: `Message` is the layout frame (alignment, grouping); `Bubble` is the utterance inside
  it. Use them together.
- **Charts** answer one named question, or they don't ship. Pass explicit `width`/`height` to
  recharts elements inside `ChartContainer` and colour series from `--chart-1` … `--chart-5`
  (a grey ramp). Never colour a series with `--sea`.
- **Density**: default controls resolve to `--control-height` (~28px), not shadcn's 36px. Use
  `sm` / `xs` in chrome; `lg` for the rare spacious control.

## Where the truth is

`_ds/<folder>/styles.css` and its imports are the whole styling contract — read them before
inventing a class. Each component's `<Name>.prompt.md` carries its real props and a **Parts** line
naming every subcomponent that composes inside it.

## An idiomatic screen: a register

```jsx
const {
  Badge, Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} = window.TagaroaUI;

const num = { fontVariantNumeric: "tabular-nums" };

<div className="bg-background text-foreground p-6 flex flex-col gap-6">
  <div className="flex items-center justify-between gap-4">
    <div>
      <h2 className="text-lg font-medium">Access reviews</h2>
      <p className="text-sm text-muted-foreground">3 of 12 overdue · quarter closes 30 Sep</p>
    </div>
    <Button size="sm">Start next review</Button>
  </div>

  <Card className="p-0 gap-0">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Review</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>People</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            <div className="font-medium">Domain administrators</div>
            <div className="text-xs text-muted-foreground font-mono">AR-0412</div>
          </TableCell>
          <TableCell>
            <div>Supply chain</div>
            <div className="text-xs text-muted-foreground">Inherited by 4 teams</div>
          </TableCell>
          <TableCell style={num}>27</TableCell>
          <TableCell>
            <Badge data-status="danger" variant="outline">Overdue 6 days</Badge>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <div className="font-medium">Emergency access grants</div>
            <div className="text-xs text-muted-foreground font-mono">AR-0415</div>
          </TableCell>
          <TableCell>
            <div>Group</div>
            <div className="text-xs text-muted-foreground">2 activations this quarter</div>
          </TableCell>
          <TableCell style={num}>2</TableCell>
          <TableCell>
            <Badge data-status="info" variant="outline">In review</Badge>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </Card>
</div>;
```

One work surface, a real question in the subtitle, IDs in mono, counts in tabular sans, state
through `data-status`, one ink primary. No stat cards above it.
