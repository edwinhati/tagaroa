# Building with the Tagaroa design system

Warm bone ground, lifted cards with thin borders, one sea-ink accent. Compact controls
(~32px). Content lives in cards like Outlier / premium ops tools, not open ledgers or gray
washes. Components come from `window.TagaroaUI` as **flat named exports** — `Card`,
`CardHeader`, `DropdownMenuItem`. There is no dot notation: `Card.Header` does not exist.

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

Other: `--radius` `--font-sans` `--font-mono`.

`--sea` is the one accent — a blue-green ink, and what `--ring` resolves to. Use it for focus and
emphasis, never as a fill for large areas. Status chips use the five `--status-*` triplets —
never sea as a status fill.

## Composition rules that matter

- **Card-first.** Group work in lifted cards (`bg-card`, thin `border-border`, soft shadow,
  `rounded-xl` (10px)). Title sits above the card. Reach for open air only when framing would
  add nothing. Do not invent hierarchy with stacks of `border-y` / `divide-y` or muted gray
  washes. `Item` is the workhorse row.
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
- **Charts**: pass explicit `width`/`height` to recharts elements inside `ChartContainer`, and
  colour series from `--chart-1` … `--chart-5`.
- **Density**: default controls are `h-8` (~32px). Use `sm` / `xs` for tighter chrome; `lg` for
  the rare spacious control.

## Where the truth is

`_ds/<folder>/styles.css` and its imports are the whole styling contract — read them before
inventing a class. Each component's `<Name>.prompt.md` carries its real props and a **Parts** line
naming every subcomponent that composes inside it.

## An idiomatic screen

```jsx
const {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  Badge,
  Button,
} = window.TagaroaUI;

<div className="bg-background text-foreground p-6">
  <h2 className="text-lg font-medium">Directory</h2>
  <p className="text-sm text-muted-foreground">50 people across 4 teams</p>

  <ItemGroup className="max-w-lg rounded-lg bg-muted/40 p-2">
    <Item>
      <ItemContent>
        <ItemTitle>Ada Okonkwo</ItemTitle>
        <ItemDescription>
          Platform team · signed in 4 minutes ago
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="secondary">Active</Badge>
        <Button size="sm" variant="ghost">
          Manage
        </Button>
      </ItemActions>
    </Item>
  </ItemGroup>
</div>;
```

Panels, not ledger lines. Muted text for secondary information. One accent, used sparingly.
