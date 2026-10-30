---
name: Tagaroa Workspace
description: Quiet work on warm ground. Soft lifted surfaces for product ops, a quieter door for sign-in.
colors:
  bone: "oklch(0.984 0.007 88)"
  ink: "oklch(0.235 0.01 250)"
  ink-strong: "oklch(0.21 0.006 80)"
  muted: "oklch(0.5 0.012 250)"
  hairline: "oklch(0.895 0.008 240)"
  field-rule: "oklch(0.655 0.011 240)"
  sea: "oklch(0.525 0.118 222)"
  card: "oklch(1 0 0)"
  panel-shadow: "0 1px 2px oklch(0 0 0 / 0.04)"
  tide-base: "rgb(249 248 244)"
  tide-light: "rgb(156 168 176)"
  tide-base-dark: "rgb(18 22 28)"
  tide-light-dark: "rgb(108 132 146)"
  destructive: "oklch(0.502 0.152 26)"
  bone-dark: "oklch(0.185 0.016 252)"
  ink-dark: "oklch(0.938 0.004 92)"
  muted-dark: "oklch(0.712 0.018 248)"
  hairline-dark: "oklch(1 0 0 / 9%)"
  sea-dark: "oklch(0.775 0.115 205)"
  card-dark: "oklch(0.228 0.017 252)"
  panel-shadow-dark: "0 1px 2px oklch(0 0 0 / 0.35)"
typography:
  display:
    fontFamily: "Geist Variable, SF Pro Text, Helvetica Neue, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.4vw, 1.95rem)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Geist Variable, SF Pro Text, Helvetica Neue, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Variable, SF Pro Text, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  hint:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, JetBrains Mono, monospace"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  meta:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, JetBrains Mono, monospace"
    fontSize: "0.775rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.12em"
  column:
    fontFamily: "Geist Variable, SF Pro Text, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.06em"
  metric:
    fontFamily: "Geist Variable, SF Pro Text, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  none: "0px"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  panel: "0.75rem"
spacing:
  field-inner: "6px"
  field-gap: "20px"
  panel-pad: "20px"
  heading-gap: "24px"
  section-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink-strong}"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    height: "28px"
  button-primary-hover:
    backgroundColor: "oklch(0.32 0.006 80)"
    textColor: "{colors.bone}"
  field-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 12px"
  work-surface:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.panel}"
    padding: "20px"
  meta-row:
    textColor: "{colors.muted}"
    typography: "{typography.meta}"
    padding: "10px 0"
---

# Design System: Tagaroa Workspace

## Overview

**Creative North Star: "Quiet work on warm ground."**

**Dial: ENERGY 1 / RHYTHM 2 / MOTION 1**

Tagaroa is a calm ops product on warm bone, not a dark developer costume and not a flat shadcn wash.
Identity is three things repeated: the three-bar mark, warm ground (never pure white or pure black),
and sea only where the keyboard is.

Light is the authored product language. Dark is a first-class peer of the same system, re-grounded
on blue-leaning charcoal so a card can lift above the page. The sign-in door stays quieter than
admin and workspace: flat inset panels and the tide motif live there alone.

**Key characteristics**

- Product work sits on one soft lifted surface (`bg-card`, thin border, `--panel-shadow`).
- Door stays flat: bordered inset panels, no work-surface shadow.
- Warm bone ground, charcoal ink, ink-filled primary actions.
- Sea reserved for focus, caret, selection, and link hover.
- Status uses five triplets plus label and shape, never colour alone.
- Geist for reading; mono only for literal strings. Counts stay sans with tabular figures.
- Forms stay compact (~28px, Supabase-class density). Collection screens earn section air.

## Where the system lives

This document is the **group design system**. Every app under `apps/` and `domains/` builds from it.
The Door chapter below is the auth surface only.

- **Tokens are the truth.** Values live in `packages/ui/src/styles/tagaroa.css`. A literal colour or
  radius in an app is a defect; missing values change the token file.
- **Components are `@repo/ui`**, imported per file (`@repo/ui/components/button`). No root export,
  no second library. Do not edit `packages/ui/src/components/` for craft (shadcn regenerates them).
  Put Tagaroa overrides in `tagaroa.css` and composition in apps or domains.
- **Foundation board** (nine artboards) lives in `.design-sync/foundation/`, published as
  Tagaroa Design Foundation. `node emit.mjs` regenerates `.dc.html` and `canvas.json` from
  `sections-*.mjs`. Never hand-edit a `.dc.html`.
- **Status vocabulary:** five triplets
  (`--status-{neutral,info,success,warning,danger}-{tint,line,text}`). `Badge` and `Alert`
  expose matching variants. Map a product state to one of five; do not invent a sixth colour.

## Named rules

**The Keyboard Rule.** Sea appears only where the keyboard currently is: focus ring, caret,
selection, hovered link. Never a button fill, never a decorative wash, never a chart series.

**The Elevation Rule.** Two registers:

1. **Door:** flat bordered inset panels on the page ground. No `--panel-shadow`. Depth comes from
   inset placement and the tide gradients.
2. **Product** (admin, workspace, domains): the primary work surface lifts once
   (`bg-card`, `border-border`, `--panel-shadow`, `--panel-radius`). Sidebar, filter bars, and
   table rows stay flat. Do not nest cards inside cards. Floating chrome (popover, dialog, toast)
   may use the same soft lift; it marks "above the page," not decoration.

**The Panel Rule.** Product structure is that lifted work surface, or open space. Content does not
live in gray washes or bare `border-y` / `divide-y` ledgers. Hairlines inside a work surface are
fine for table headers and row separators. Enforce in `tagaroa.css` and app composition.

_Scoped exception:_ `apps/admin`'s standing column is a plane (`--sidebar`, one step off the page
in the same warm hue). The current section is a filled rounded rect, not a bordered card. Still
no nested cards; still no second border weight.

**The Chromatic Rule.** Core palette is bone, ink, hairline, field rule, plus one accent (sea) and
destructive for failures. Primary actions fill with ink (`--primary`), never sea and never a
generic blue. Status chips use the five triplets with text and shape (or an icon). Do not add a
category rainbow (Design / Frontend / Backend style) unless a real domain taxonomy ships later.

**The Small Control Rule.** Prefer Supabase-class density: controls stay small
(~28px / `sm`), type around 12px, icons ~14px. If a control needs to be bigger to be
noticed, the problem is the space around it. Add air between sections; never scale the
box. Collection screens still breathe (`~24px` section gaps) without enlarging chrome.

## Colors

Warm achromatic system. Sea is the only saturated brand accent, and it stays on the keyboard.

### Neutrals

- **Bone** (`oklch(0.984 0.007 88)`, `--background`): page ground.
- **Card** (`oklch(1 0 0)`, `--card`): lifted work surface in light; in dark,
  `oklch(0.228 0.017 252)` so the card sits above the ground.
- **Ink** (`oklch(0.235 0.01 250)`, `--foreground`): body and headings. Primary button uses
  `--primary` (`oklch(0.21 0.006 80)`), a half-step darker and warmer.
- **Muted** (`oklch(0.5 0.012 250)`, `--muted-foreground`): supporting copy. Must stay ≥4.5:1
  on bone for text at 13px and above.
- **Hairline** (`oklch(0.895 0.008 240)`, `--border`): panel edges and dividers.
- **Field rule** (`oklch(0.655 0.011 240)`, `--input`): resting input border, darker than a divider
  so a field reads as interactive at rest.

### Accent and semantic

- **Sea** (`oklch(0.525 0.118 222)` light / `oklch(0.775 0.115 205)` dark): focus, caret, selection,
  link hover only.
- **Destructive** (`oklch(0.502 0.152 26)`): field and form failure. Action chrome uses it as a tint,
  not a solid red block.
- **Status triplets:** product state chips and page alerts. Pair colour with label and marker shape.

### Tide (door only)

`--tide-base` / `--tide-light` as RGB triples for gradient alpha. Light:
`249 248 244` → `156 168 176`. Dark: `18 22 28` → `108 132 146`. Decorative; never product chrome.

### Theme

Three states: **system** (default, `prefers-color-scheme`), **light**, **dark**. Forced choice adds
`.light` or `.dark` on `<html>`, persists under `tagaroa-theme`, applied by a boot script before
first paint. Product and door both support the toggle; both modes must remain complete.

### Elevation tokens

- `--panel-radius`: `0.75rem` (12px) for product work surfaces, dialogs, toasts.
- `--panel-shadow`: `0 1px 2px oklch(0 0 0 / 0.04)` light;
  `0 1px 2px oklch(0 0 0 / 0.35)` dark. One soft step. No glow stacks. No shadow on every control.

## Typography

**Sans:** Geist Variable (SF Pro Text, Helvetica Neue, system-ui). Apps must
`@import "@fontsource-variable/geist"` (and geist-mono) in their own `app.css`.

**Mono:** Geist Mono Variable, only for literal strings (keys, IDs, destinations, secrets, hard
field rules). Counts and clocks stay in the UI sans with `tabular-nums`.

Inter, Roboto, and geometric-grotesk defaults are excluded. Geist is chosen as a quiet workhorse
that stays out of the way while someone types a password or scans a register.

### Hierarchy

- **Display** (door): 500, `clamp(1.5rem, 2.4vw, 1.95rem)`, 1.12, −0.03em. One per auth screen.
- **Page title** (product): ~18px / 600 / −0.02em. Names the work, not the brand.
- **Body:** 0.875rem / 400 / 1.55 (`--text-sm`).
- **Label:** 0.8125rem / 500 (`--text-xs`). Always visible; placeholders are never labels.
- **Hint:** mono, 0.78rem (`--text-2xs`), muted, on the label row when it states a hard rule.
- **Column header:** 0.6875rem / 500 / 0.06em / uppercase. Tables only.
- **Metric** (`apps/admin`): 1.375rem sans tabular. Figures only.

Secondary type must recede: muted weight and colour, not a second loud size.

## Layout and density

- **Product:** page pad 16–24px (24–32px from ≥1280). Section gap ~24px on collection screens.
  One primary action per view. Prefer one work surface over stacks of equal cards.
- **Admin sidebar:** plane exception above; expanded width 16rem.
- **Workspace / domains:** `@repo/shell` header chrome; no copied sidebars.
- **Door:** see Door chapter (21rem form column, tide inset beside it from `lg`).

## Shapes and scale

| Role                   | Token                 | Value             |
| ---------------------- | --------------------- | ----------------- |
| Tight / badge-adjacent | `--radius` ×0.75 → sm | `0.375rem` (6px)  |
| Controls and inputs    | `--radius` (md)       | `0.5rem` (8px)    |
| Alerts / mid shells    | lg                    | `0.625rem` (10px) |
| Work surface / panel   | `--panel-radius`      | `0.75rem` (12px)  |
| Door form and tide     | hand                  | `1rem` (16px)     |

Base `--radius` is `0.5rem`. Controls share md and `--control-height` (~28px). Nothing is a
pill button. Status chips may use a fuller radius than controls; they still are not marketing
capsules.

## Motion

Dial MOTION 1: hover, focus, and feedback only on product surfaces.

Shared tokens: `--ease-out`, `--ease-in-out`, feedback ~140ms, UI ~200ms, route ~220ms.
Focus ring transitions colour and box-shadow so tabbing retargets. Errors may use a short
`rise-in` (opacity + 4px). Route changes crossfade via View Transitions; nothing slides.
Long ambient motion (tide 18s / 24s) is door-only. `prefers-reduced-motion` keeps fades and drops
movement.

## Components (system)

### Work surface

Primary product container: `bg-card`, 1px `border-border`, `--panel-shadow`, `--panel-radius`,
comfortable padding. One per major region. Tables live inside it; rows do not cast shadows.

### Primary button

Ink fill, bone text, md radius, control height, no shadow. Names the outcome
("Create a role", "Email me a link"), not the mechanism. One primary per view.

### Field

Visible label, optional mono hint, bordered input, sea focus ring from `--ring`. Invalid swaps
to destructive. Validate on blur; report on submit.

### Status

`Badge` / `Alert` variants map to the five triplets. Always include readable text; prefer a
marker shape when greyscale must still work.

### Mark

Three vertical bars (`@repo/ui/blocks/logo`) in `currentColor`. Auth: 22px corner mark, company
name in the screen title. Product: same mark language in shell chrome; no decorative wordmark lockup.

## Door

Auth alone. North star locally: a quiet door beside the tide. Operator passes through in about
fifteen seconds. Every element identifies whose workspace this is or accepts a credential.

### Composition

- Full-width header: mark left, theme control right.
- From `lg`: two equal columns. Left centres a 21rem stack (display, optional sentence, form panel).
  Right is the tide panel.
- Tide and form panels are inset, 16px radius, 1px border, flat (no `--panel-shadow`).
- Below `lg`, drop the tide; keep header and form panel.

### Tide

Two radial gradient layers between `--tide-base` and `--tide-light`, transform-only drift.
Hidden below `lg`. No content over the tide. Omitted from the accessibility tree.

### Door motion

Focus ring, error `rise-in`, route crossfade, tide drift. Nothing else.

### Door do and don't

**Do:** state constraints before violation; theme selection, caret, scrollbar, focus from this
palette; keep the working column short; say who does what; cut lines an operator already knows.

**Don't:** put sea anywhere the keyboard cannot go; brand the credential screen beyond mark + title;
add a third container; offer self-serve sign-up; promise mail the server cannot send; use mono as
costume; put product work-surface shadows on the door.

## Product patterns

Screens pick a pattern and fill it. A screen that fits none is a design conversation first.

- **Register:** table, tabular counts, one primary, row is the link.
- **Object detail:** breadcrumb, status chip, mono meta, tabs for one object.
- **Review queue:** default filter needs a person; approve is default; reason on refuse.
- **Console:** list + detail; payloads in mono; retry is outline.
- **Administration:** form ≤576px; scope shows inheritance; privileged needs reason + fresh MFA.

No opening row of invented stat cards. Charts answer a named question or they do not ship.

## Do's and don'ts

**Do**

- Take colour, radius, elevation, and type from tokens.
- Lift one work surface on product pages; leave chrome flat.
- Keep status in the five triplets with text (and shape when useful).
- Give collection screens section air without enlarging controls.
- Ship empty, loading, and error states that name cause and next action.

**Don't**

- Stretch door flatness across admin and workspace, or product shadows across the door.
- Use sea on buttons, fills, or decoration.
- Add category rainbow chips or a second brand accent.
- Nest cards, glow everything, or float every component.
- Clone Linear, Vercel, or another product's overall look.
- Edit shadcn component sources for Tagaroa craft.
