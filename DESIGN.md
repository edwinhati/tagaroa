---
name: Tagaroa Workspace
description: A live water surface in neutral tones — the form sits in the calm at its centre, the tide moves at the edges.
colors:
  bone: "oklch(0.984 0.007 88)"
  ink: "oklch(0.22 0.006 80)"
  ink-strong: "oklch(0.21 0.006 80)"
  muted: "oklch(0.545 0.006 85)"
  hairline: "oklch(0.898 0.005 88)"
  field-rule: "oklch(0.878 0.005 88)"
  sea: "oklch(0.525 0.118 222)"
  tide-base: "rgb(249 248 244)"
  tide-light: "rgb(156 168 176)"
  tide-base-dark: "rgb(22 26 33)"
  tide-light-dark: "rgb(108 132 146)"
  destructive: "oklch(0.502 0.152 26)"
  bone-dark: "oklch(0.209 0.016 252)"
  ink-dark: "oklch(0.938 0.004 92)"
  muted-dark: "oklch(0.678 0.011 232)"
  hairline-dark: "oklch(1 0 0 / 11%)"
  sea-dark: "oklch(0.775 0.115 205)"
typography:
  display:
    fontFamily: "SF Pro Text, SF Pro Display, Geist Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.4vw, 1.95rem)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  body:
    fontFamily: "SF Pro Text, SF Pro Display, Geist Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "SF Pro Text, Geist Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  hint:
    fontFamily: "SF Pro Text, Geist Sans, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  meta:
    fontFamily: "ui-monospace, SF Mono, Geist Mono, JetBrains Mono, monospace"
    fontSize: "0.775rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.12em"
rounded:
  none: "0px"
  sm: "0.225rem"
  md: "0.3rem"
  lg: "0.375rem"
  panel: "1rem"
spacing:
  field-inner: "6px"
  field-gap: "20px"
  panel-pad: "20px"
  heading-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink-strong}"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    height: "36px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "oklch(0.32 0.006 80)"
    textColor: "{colors.bone}"
  field-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.bone}"
    rounded: "{rounded.panel}"
    padding: "20px"
  meta-row:
    textColor: "{colors.muted}"
    typography: "{typography.meta}"
    padding: "10px 0"
---

# Design System: Tagaroa Workspace

## Overview

**Creative North Star: "The calm at the centre of the tide"**

Tagaroa is the god of the sea, and the surface is literally that: a live water
surface — domain-warped noise sharpened into caustic light — rendered in WebGL across the
whole viewport. It is never still. The form sits in the calm at its centre, where a radial
falloff quiets the water so nothing competes with reading or typing; the motion lives at the
edges, in peripheral vision.

The palette stays neutral on purpose. The water is graphite and silver on bone in light,
slate and cold light on near-black in dark — the interest comes from the surface being alive,
not from colour. Nothing is a card, nothing floats on a shadow, and there is no second pane:
one continuous ground, one column of content.

Density is low and deliberate. The auth surface is a door someone passes through in fifteen
seconds; every element on it either identifies whose workspace this is or accepts a
credential. Nothing else earns a place — an operator signing in does not need to be told the
session cap, the hostname, or that the company invites its own staff.

Color is almost entirely absent. A single sea-ink accent, drawn from the name (Tagaroa, the
Austronesian god of the sea), appears only where the keyboard is: the rule under a focused
field, the caret, the selection, a hovered link. Nothing else in the system is allowed to
use it, which is what makes focus unmistakable without a glowing box.

**Key Characteristics:**

- Two matching bordered panels are the only structure; shadows and dividers are absent by rule.
- Warm bone ground, warm charcoal ink — never pure white, never pure black.
- One accent, reserved for the focused element and browser surfaces.
- Mono is reserved for operational metadata and numbers, never for atmosphere.
- Two panes: one does the work, one carries the mark at scale. Neither explains itself.

## Colors

A warm achromatic system with a single cool accent — the only saturated thing on screen.

### Primary

- **Tide base / light** (`rgb(249 248 244)` → `rgb(156 168 176)` light,
  `rgb(22 26 33)` → `rgb(108 132 146)` dark): the two ends of the water. Stored as RGB
  triples rather than oklch because the shader consumes them directly.
- **Sea** (`oklch(0.525 0.118 222)` light / `oklch(0.775 0.115 205)` dark): The focus ring
  under an active field, the caret, text selection, link hover. Never a background, never a
  button fill, never decoration.

### Neutral

- **Bone** (`oklch(0.978 0.004 92)`): The page ground. Warm off-white; pure white is used
  only for popover surfaces inherited from `@repo/ui`.
- **Ink** (`oklch(0.22 0.006 80)`): Body and heading text, and the primary button fill.
  Warm charcoal, never `#000`.
- **Muted** (`oklch(0.545 0.006 85)`): Supporting sentences, mono meta labels, hints.
- **Hairline** (`oklch(0.898 0.005 88)`): Input borders and both panel borders.
- **Field rule** (`oklch(0.878 0.005 88)`): The resting underline of an input — one step
  darker than a divider, so a field reads as interactive at rest.

### Semantic

- **Destructive** (`oklch(0.502 0.152 26)`): Field errors, form failure text, and the 1px
  rule beside a failed submission.

### Dark

The same system re-grounded on a blue-leaning charcoal (`oklch(0.209 0.016 252)`) — never
black, which read as grim rather than serious — with hairlines at 11% white and the accent
lifted for contrast.

### Theme

Three states: **system** (the default, following `prefers-color-scheme`), **light**, and
**dark**. A forced choice adds `.light` or `.dark` to `<html>` and persists in
`localStorage` under `tagaroa-theme`; a boot script in `<head>` applies it before first
paint, so a forced theme never flashes. The control is a single icon button in the top-right
of the form pane that cycles light → dark → system; its icon is the _current_ state, and its
`aria-label` names both that state and the next one.

### Named Rules

**The Keyboard Rule.** Sea appears only where the keyboard currently is — the focused
field's rule, the caret, the selection. If the accent shows up anywhere a keyboard cannot
be, it is wrong.

**The One Line Rule.** Structure is a 1px hairline or it is nothing. No card, no shadow, no
second border weight, no nested container. Elevation is declared once, and here it is
declared as _none_.

## Typography

**Display / Body Font:** SF Pro Text with SF Pro Display, Geist Sans, Helvetica Neue,
system-ui fallbacks
**Label/Mono Font:** ui-monospace with SF Mono, Geist Mono, JetBrains Mono fallbacks

**Character:** A workhorse system sans doing all the reading, paired with a mono that is
allowed out only for facts — policy rows, hosts, character counts. The pairing has no
editorial ambition; its job is to be unnoticed at the moment someone is typing a password.
Inter, Roboto, and the geometric-grotesk defaults are deliberately excluded.

### Hierarchy

- **Screen title** (500, 1.6rem, 1.15, -0.02em): One per screen, naming the action
  ("Sign in", "Accept invitation") or the state ("This reset link has expired").
- **Supporting sentence** (400, 0.95rem, 1.6): Optional, and omitted whenever the title is
  self-evident. When present it states what happens next or what went wrong, in one line —
  never two.
- **Field label** (500, 0.82rem): Above every input, always visible — placeholders are never
  used as labels.
- **Field hint** (mono, 0.68rem, muted): Right-aligned on the label row. Carries the rule
  before the user can break it ("12 characters minimum").
- **Screen title** carries the company name where it matters ("Sign in to Tagaroa"), so no
  wordmark lockup is needed anywhere on the surface.

## Layout

Modelled on Claude's sign-in page, which is the reference for this composition.

- **Full-width header:** the mark at 18px left, the theme control right. It spans the
  viewport and belongs to neither column.
- **Two equal columns from `lg`,** inset from the page edge and from each other by the same
  gap the header uses. The left column centres a 21rem stack — display line, supporting
  sentence, then the form's panel. The right column is the water.
- **The water panel is inset, not flush.** Rounded 16px, 1px border, with real margin on
  every side. A pane running edge to edge reads as a template; an inset panel reads as an
  object placed on the page, which is the whole difference.
- **Below `lg` the water panel is dropped** and the left column takes the screen. The header
  and the panel'd form are unchanged, so there is no second design to maintain.
- **Calm radius** is `-0.35` — negative, meaning no calm at all. Nothing sits over the water
  any more, so it runs alive edge to edge.
- **Rhythm:** 24px under the display line, 20px between fields, 6px inside a field group,
  20px of padding inside the panel. More space above a heading than below it, everywhere.

## Motion

Three animations exist on this surface. Anything beyond them is a defect, not a feature.

- **Tokens:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--duration-feedback: 140ms`,
  `--duration-ui: 200ms`. Nothing declares its own curve.
- **Focus ring** (150ms, `--ease-out`): inherited from `@repo/ui`'s Input transition on
  `color` and `box-shadow`. A transition, not keyframes, so tabbing quickly through fields
  retargets instead of restarting.
- **Error entry** (`rise-in`, 180ms, `--ease-out`): field and form errors fade up 4px into
  place, so a message that changes the form's height never teleports.
- **Route change** (220ms crossfade, `--ease-out`): navigation between auth screens runs
  through the View Transitions API — TanStack Router's `viewTransition` on every in-app
  `Link`, styled with `::view-transition-old(root)` / `::view-transition-new(root)`. Crossfade
  only; nothing slides.
- **The tide** (continuous, ~0.05 time scale): the one thing on this surface that never
  stops. It is atmosphere, not feedback, and it now lives in its own panel with no content
  over it — so it may run freely without competing with anything being read or typed. An
  earlier version of this document banned all continuous motion here; the tide is the
  deliberate exception, and the separate panel is what earns it.
- **Reduced motion** keeps every fade and drops every movement: `rise-in` becomes opacity
  only, route crossfades are removed, and the tide freezes to one still frame — the water is
  still there, it simply stops moving.

## Elevation & Depth

No shadows. There is no shadow token. Depth comes from the water, which is real rather than
simulated, and from two flat bordered panels sitting on the page ground. `@repo/ui` components that ship with
`shadow-xs` have it removed at the call site rather than re-themed.

## Shapes & scale

Controls are small and quiet; the space comes from what surrounds them, not from their size.

- Inputs and the primary button share one radius (`--radius-md`, ~4.8px) and one height:
  **36px** on pointer devices, **40px** below `sm` so a finger still has a target.
- The content column is **21rem (336px)** — narrow enough that the water reads as the page
  and the form as an object placed on it.
- Nothing is a pill, and no element on the auth surface exceeds that radius.

### Type scale

Small controls, one display line. The range is short on purpose.

| Role                                 | Size                                        |
| ------------------------------------ | ------------------------------------------- |
| Display line                         | clamp(1.5rem, 2.4vw, 1.95rem), 500, -0.03em |
| Supporting sentence                  | 0.875rem / 14px                             |
| Input text, button label             | 0.875rem / 14px                             |
| Field label                          | 0.8125rem / 13px, 500                       |
| Supporting sentence, footnote, links | 0.8125rem / 13px                            |
| Field hint, error                    | 0.775–0.78rem                               |

**The Small Control Rule.** If a control needs to be bigger to be noticed, the problem is
the space around it, not its size. Add air; never scale the box.

## Components

### Field

Label row (13px label left, optional hint or link right), then a bordered 36px input on a
faint `--input/25` fill, then an error line when invalid. Focus is a sea ring drawn by `@repo/ui`'s Input from `--ring`;
invalid fields swap border and ring to destructive. Placeholders are examples
(`you@tagaroa.com`), never a substitute for the label, which is always visible.

### Primary button

Full width of the working column and the same height as the inputs — 36px on pointer
devices, 40px below `sm` — ink fill on bone text, smallest radius, no
shadow. Disabled during submission with the verb switched to its progressive form
("Signing in…"). Inherits `@repo/ui`'s 1px active translate.

### Form error

A single destructive 1px rule on the inline-start edge with the message beside it. It names
the problem and the recovery in one sentence; it never renders an error code alone.

### Mark

Three vertical bars in a 100-unit square (`@repo/ui/components/logo`), drawn in
`currentColor` so it inherits the ink of whatever it sits in. It reads as ruled columns —
the same structure the page is built from. On an auth screen it appears once, at 22px in
the top-left, with no wordmark and no tagline beside it; the screen title carries the
company name instead ("Sign in to Tagaroa").

### Panel

The form's container: 1px border, 16px radius, `--card/60` fill, 20px padding. It exists so
the form reads as one object under the display line, the way Claude encloses its inputs. It
is the only container on the content side — nothing nests inside it.

### The tide

A fragment shader (`src/components/tide.tsx`): five octaves of value-noise fBm, domain-warped
twice, with the level sets sharpened by `pow(1 - |sin(f)|, 3.4)` into caustic lines. One
full-screen triangle, one draw call, DPR capped at 1.5. Its two colours come from
`--tide-base` and `--tide-light` as plain RGB triples, so the theme decides what the water is
made of and the shader never parses a colour.

It pauses on a hidden tab, freezes to a single frame under `prefers-reduced-motion`, and
falls back to a radial gradient in the same two tokens when WebGL is unavailable. It starts
mid-tide, never from a flat field. When its panel is hidden below `lg` the canvas measures
zero and the loop stops rather than rendering into an empty buffer.

The panel carries the radius on the canvas itself rather than clipping it with
`overflow-hidden`: a clipped WebGL layer forces a compositor mask that costs real frames.

### State screens

An expired link, an incomplete invitation, and a sent reset all render as title + sentence +
one text link, in the same column as the form. No illustration, no icon, no empty-state art.

## Do's and Don'ts

**Do**

- State a constraint before the user can violate it (password length, breach rejection,
  single-use links).
- Theme the browser's own surfaces — selection, caret, scrollbar, focus — from this palette.
- Let the working column stay short. A door that scrolls has failed.
- Keep controls small and let emptiness do the work. Supabase's dashboard is the reference
  for this register: 13–14px type, 36px controls, a narrow column, and a great deal of
  nothing around it.
- Say who does what. "We check new passwords against known breaches", not "breached
  passwords are rejected" — the system owns its actions.
- Name the outcome on a button, not the mechanism: "Email me a link", not "Send reset link".
- Cut any line an operator already knows. Session caps, hostnames, and "accounts are
  created from an invitation" are facts about the system, not help for the person signing
  in.

**Don't**

- Don't introduce a card, panel, shadow, or second border weight.
- Don't put the accent anywhere the keyboard cannot go.
- Don't brand the credential screen — a 22px mark in the corner and the company's name in
  the screen title is the whole identity treatment. The tide carries no message.
- Don't put content over the water. It has its own panel; text lives in the other column.
  If something ever must sit on it, raise the calm radius rather than dimming the water.
- Don't add a third container. Two exist, they match, and that is the system.
- Don't offer a sign-up path, a social provider, or any language implying self-serve access.
- Don't promise an email that the server has no sender configured to send.
- Don't use mono as a "technical" costume; it carries data or it doesn't appear.
