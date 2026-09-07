# design-sync notes — @repo/ui

Repo-specific gotchas for future syncs. Read this before re-running the converter.

## The package has no build, and that is deliberate

`@repo/ui` is a source-only internal workspace package: `exports` points straight at `.tsx`,
and the four consuming apps compile it themselves. There is no `dist/`, no `.d.ts`, and no
`build` script. The converter needs a built entry plus a `.d.ts` tree, so this sync
**synthesises a throwaway one** into `packages/ui/.ds-dist/` (gitignored) rather than adding a
permanent build to the package — adding one would change how `apps/admin`, `apps/auth`,
`apps/workspace` and `domains/engineering` resolve it, which is a decision of its own.

`node .design-sync/prepare.mjs` recreates the whole throwaway build and exits non-zero if
anything is off. Run it from the repo root before every sync; everything it writes is
gitignored and safe to delete. It does, in order:

1. **Barrel entry** — `packages/ui/src/_ds-entry.ts`, one `export * from "./<file>"` line per
   `components/*.tsx`, `blocks/*.tsx`, `hooks/*.ts`, `lib/*.ts`, skipping `*.test.*`.
2. **Tailwind entry** — `packages/ui/src/_ds-styles.css` (see below).
3. **Declarations** — `tsc --emitDeclarationOnly` into `packages/ui/.ds-dist`, then
   `_ds-entry.d.ts` → `index.d.ts`. Two traps it handles: TypeScript 7 has **removed
   `baseUrl`** and errors if it is present, so `paths` is absolute; and the package's own
   config is `NodeNext`, which rejects the barrel's extensionless imports, so the generated
   config overrides `moduleResolution` to `bundler`.
4. **`componentSrcMap`** — re-derived from those declarations and written back into
   `config.json` (see below).
5. **JS entry** — esbuild `--bundle --format=esm --packages=external --jsx=automatic` over the
   barrel to `.ds-dist/index.es.js`. `--packages=external` matters: the converter re-bundles
   and resolves dependencies itself via `--node-modules`. Plus the `package.json` beside it —
   the converter reads `types` from it and fails with a bare `ENOENT ... package.json` without one.
6. **Fonts** — `packages/ui/.ds-fonts/`, resolved from whichever app has fontsource installed.
7. **CSS** — compiled last, after the previews are on disk.

Then: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules packages/ui/node_modules --entry packages/ui/.ds-dist/index.es.js --out ./ds-bundle`

## Config paths resolve against the entry's directory, not the package

Because `--entry` points into `packages/ui/.ds-dist/`, that directory is the config's `pkgRoot`.
Every path field in `config.json` is relative to **it**, not to `packages/ui`. This is why
`cssEntry` is `styles.css` (already inside `.ds-dist`), `tsconfig` is `../tsconfig.json`,
`extraFonts` is `../.ds-fonts/fonts.css`, `docsDir` is `../../../.design-sync/docs`, and every
`componentSrcMap` value starts `../src/`. Paths written relative to the package are silently
skipped with a `! <field>: ... not found — skipped` line — check for those in the build log.

## CSS must be compiled separately (Tailwind v4 `@source`)

The apps build their own CSS; the package ships none. Tailwind v4 generates utilities by
scanning `@source` paths, so a stylesheet compiled without the right sources is missing most
component classes and everything renders unstyled.

`packages/ui/src/_ds-styles.css` (written by `prepare.mjs`, gitignored) is the sync's entry:

```css
@import "tailwindcss";
@import "./styles/globals.css";
@import "./styles/tagaroa.css";
@source "./";
@source "../../../.design-sync/previews";
```

Compiled with `@tailwindcss/cli` at the repo's own `tailwindcss` version to
`packages/ui/src/_ds-styles.built.css`, then copied to `packages/ui/.ds-dist/styles.css`.

The **second `@source` line is load-bearing**: authored preview files live outside the package,
so without it any utility class used only in a preview is never generated and that card renders
unstyled. Recompile the CSS after authoring previews, not before.

Note `globals.css` carries its own `@source "../../../apps/**"` and `@source "../../../components/**"`,
which resolve to `packages/apps` and `packages/components` — neither exists. They are dead
globs, harmless, and predate this sync.

## Geist: fixed at source

`tagaroa.css` used to name `"Geist Sans"` / `"Geist Mono"`, families that exist nowhere —
fontsource ships them as **`"Geist Variable"` / `"Geist Mono Variable"`** — and each of the four
apps carried the same three-line `:root` correction. `tagaroa.css` now names the real families
and the four duplications are gone. An app still has to `@import "@fontsource-variable/geist"`
to ship the face, because the package ships no CSS; all four do.

`prepare.mjs` copies the four latin variable woff2 files into `packages/ui/.ds-fonts/`
(gitignored) with a generated `fonts.css`, wired through `cfg.extraFonts`. It resolves them from
whichever of the four apps has them installed rather than pinning `apps/admin`.

## Component discovery over-produces without `componentSrcMap`

The converter treats every PascalCase `.d.ts` export as a component, which for a shadcn-style
compound library is **368 entries** — every `AccordionItem`, `DialogPortal`, `SidebarMenuSub`.
`componentSrcMap` pins the 62 roots to their source files and nulls the other 306. The nulled
subcomponents still ship in the bundle and stay fully usable; they just have no card of their
own. Each root's `.prompt.md` lists them under a **Parts** line, generated from the source's
own export list.

**Do not edit the map by hand — `prepare.mjs` regenerates it** from the emitted declarations
every run, and prints what it added or dropped. A root's name is its filename in PascalCase;
the exceptions live in two literals at the top of that script:

- `HAND_PINNED` — roots whose export does not match the filename: `chart` → `ChartContainer`,
  `input-otp` → `InputOTP`, `resizable` → `ResizablePanelGroup`, `data-table` → `DataTableView`.
- `NO_CARD` — files that ship in the bundle but get no card: `components/direction`
  (`DirectionProvider`), `blocks/theme` (`ThemeProvider`, `ThemeToggle`, `themeBootScript`) and
  `blocks/password-input`.

A file whose root export matches neither its filename nor a `HAND_PINNED` entry is a hard error
rather than a silent omission — the map used to leave `PasswordInput` out entirely, which per the
converter's discovery rules would have produced a card with no doc and no preview. It is now
explicitly nulled.

A new component still needs its `.design-sync/docs/<Name>.md` and `.design-sync/previews/<Name>.tsx`;
`prepare.mjs` fails if either is missing, or if one exists with no matching root.

## Grouping comes from the docs, not the source tree

`.design-sync/docs/<Name>.md` holds one file per component: YAML frontmatter `category` sets the
card's group, and the body is **prepended** to the synthesised props block rather than replacing
it — so a short doc adds orientation without losing the generated API contract. The eight groups
are Forms, Overlays, Navigation, Data display, Feedback, Layout, Chat, and blocks (the last
derived from the source directory for `DataTableView`).

## Preview contract

Authored previews live in `.design-sync/previews/<Name>.tsx` (committed, never machine-written).
Two things that cost a debugging cycle to learn:

- **Every export must be a function component.** The harness collects cells with
  `typeof window.__dsPreview[k] === 'function'`, so `export const Variants = <div/>` is silently
  dropped and the component falls back to its floor card. Write `export const Variants = () => (…)`.
- **Import from `"@repo/ui"`**, and subcomponents are flat named exports —
  `import { Card, CardHeader } from "@repo/ui"`, not `Card.Header`.

## Re-sync risks

- **The throwaway build artefacts are not in git.** A fresh clone has no `.ds-dist/`,
  `.ds-fonts/`, `_ds-entry.ts` or `_ds-styles*.css`. Run `node .design-sync/prepare.mjs` first;
  the converter will not run at all without them.
- **The fonts come from an app's `node_modules`.** On a clone with no `bun install`,
  `cfg.extraFonts` resolves to nothing and every card silently renders in a fallback face.
  `prepare.mjs` fails loudly on this; also check the build log for `fonts: 4 @font-face rule(s)`.
- **`.design-sync/docs/` descriptions are hand-written** and will drift as components change.
  The `Parts` lines are generated from source and stay accurate on regeneration.
- **TypeScript version.** Declarations are emitted with the repo's TypeScript 7.0.2, which has
  removed `baseUrl`. An older TypeScript needs `prepare.mjs`'s generated config adjusted.
- **`.design-sync/foundation/tagaroa-design-foundation.html` is gitignored.** It is the
  design-canvas viewer export — 4.3MB of inlined editor runtime and base64 fonts, rewritten
  whole on every change. The nine `.dc.html` artboards and `emit.mjs` are the sources; re-export
  the viewer from the canvas when you need it.

## Authoring previews: the traps this repo actually hits

Folded from the five authoring waves. Every one of these fails **silently** — no build error,
no console error, just a wrong-looking or blank card.

### Grading from capture sheets cannot see grid overflow

`package-capture.mjs` screenshots each cell **full-viewport** (900x700, or a declared
`viewport` override) with no transform and no clipping. The product's card grid renders cells
inside a clipped, transformed box. So a preview can grade `good` from its capture sheet and
still be cropped in the real card. Four of five waves independently concluded "no `cardMode`
override needed"; `package-validate.mjs`'s grid check then flagged **18** components.

**Only validate's `[GRID_OVERFLOW]` line is authoritative for card presentation.** Run a full
validate after authoring and apply what it names — `cardMode: "column"` for content wider than a
grid cell, `cardMode: "single"` plus a `primaryStory` for fixed/portal content that positions
outside its cell. Both live in `cfg.overrides.<Name>`.

### An uncompiled Tailwind class is worse than a no-op

The stylesheet is precompiled, so a utility that appears in no scanned source is simply absent.
Two distinct failure modes, both silent:

- On a plain wrapper the class does nothing and the element collapses — `h-64` flattened
  `ResizablePanelGroup` to a hairline, `h-48`/`max-w-40` collapsed `AspectRatio`, `ScrollArea`
  and `Skeleton`, `h-72 w-96` left `MessageScroller` with no scroll container at all.
- On a design-system component it is **worse than nothing**: these components merge classes
  through `cn()`/`tailwind-merge`, which recognises `w-40` as a width utility and **evicts the
  component's own working `w-fit`** — leaving `ButtonGroup` unconstrained and full-width. An
  absent class can therefore break a component that was fine before you touched it.

Order of preference when sizing a preview container: an inline `style={{ height: 256 }}` (cannot
be evicted, cannot depend on compile timing) > a class already present in the compiled sheet
(`grep '\.h-64' packages/ui/src/_ds-styles.built.css`) > recompiling the CSS. Recompile after
authoring, never before: `@source "../../../.design-sync/previews"` only picks up classes that
exist on disk at compile time.

### Base UI menu labels crash the whole story

`ContextMenuLabel`, `MenubarLabel` and `DropdownMenuLabel` throw synchronously when not wrapped
in the matching `*Group`: _"Base UI: MenuGroupContext is missing. Menu group parts must be used
within <Menu.Group> or <Menu.RadioGroup>."_ The card harness catches synchronous throws from
`createRoot().render()` but not render-phase errors inside React's commit, so the root dies with
**zero visible output** — no error text, no partial render, not even the trigger. A blank PNG
here reads exactly like a portal-escape problem and is not one. Hit independently by two waves.

To see the real error, point Playwright at
`components/<group>/<Name>/<Name>.html?story=<Cell>` with a `pageerror` listener, or read
`pageErrs` in `.design-sync/.cache/review/<Name>.json`.

### recharts is bundled twice

`_preview/<Name>.js` and `_ds_bundle.js` are built independently and only React and the DS
package are externalised, so each carries **its own copy of recharts**. Module-scope context
does not cross that boundary: `BarChart`/`LineChart` imported into a preview never see the
sizing from `ChartContainer`'s `ResponsiveContainer` (the other copy) and render at 0x0, while a
`ChartLegend`/`ChartTooltip` taken from `@repo/ui` is a different module identity and is silently
dropped. Anything composing raw recharts primitives under `ChartContainer` hits all three.

Working recipe: explicit numeric `width`/`height` on the chart, `Legend`/`Tooltip` imported
straight from `"recharts"`, and `isAnimationActive={false}` on every `Bar`/`Line` — recharts'
~1500ms draw-in otherwise freezes mid-stroke under the capture's settle wait.

### Smaller ones

- **`react-resizable-panels` 4.12.3 uses `orientation`, not `direction`.** The older prop that
  most copied shadcn examples pass is silently ignored, so a "vertical" group renders horizontal.
  `Panel`'s `defaultSize` is pixels as a bare number, percent only as a unitless string.
- **`currentColor` components need ambient color from the preview.** The card body has no theme
  wrapper, so `Logo` renders invisible unless its own wrapper sets `text-foreground` or similar.
  This is a preview concern, not a component bug.
- **`AvatarBadge` uses `bg-blend-color`**, which blends a saturated override against the white
  backdrop's luminosity and eats it. `bg-destructive` came out nearly invisible; the default
  `bg-primary` is the reliable choice. `AvatarFallback` and `AvatarGroupCount` do not blend.
- **`Command` is not portal-based** — only `CommandDialog` is. The bare primitive is a `cmdk`
  div and is as static-friendly as any composed leaf.

## Known render warns (updated after the final build)

- `[TOKENS_MISSING]` - 20 custom properties set at runtime in JS, never by a stylesheet
  (`--toast-index`, `--accordion-panel-height`, `--drawer-swipe-progress`, `--toast-height`,
  `--toast-offset-y`, `--toast-swipe-movement-x/y`, `--nested-drawers`, plus the Base UI
  positioner vars `--popup-height`, `--positioner-height`, `--available-height`,
  `--anchor-width`, `--popup-width`, `--positioner-width`, ...). Expected. The count grows
  whenever a Base UI popup primitive is added - same class, not a regression.
- `[FONT_MISSING]` - `"SF Pro Text"` and `"JetBrains Mono"`. Both are fallback entries further
  down the stacks; the families that resolve first, Geist Variable and Geist Mono Variable, do
  ship. Expected.
- `[RENDER_THIN]` on `AlertDialog` ("variants render identically") and `Sheet` ("rendered height
  is 1px"). Both are portal components whose measured host element genuinely collapses while the
  portalled content renders correctly - confirmed against the screenshots. Benign.
- `[DTS_STYLE_SYSTEM]` - `@types/react` prop filtering. Informational.

- `Sidebar` / `Workspace` bottom-edge clip. `SidebarProvider` sets `min-h-svh`, so the rendered
  document is exactly one viewport tall plus the capture harness's body padding, and the
  screenshot is viewport-only — the last ~18px of the footer falls below the fold. Raising
  `cfg.overrides.Sidebar.viewport` does not help: the footer is bottom-anchored, so a taller
  viewport just moves the same cut down. Constraining the wrapper's height makes it worse (the
  inset panel shrinks while the `h-svh` sidebar column does not). Graded good deliberately —
  the component renders completely and correctly, and filling the viewport is what a sidebar is.

## conventions.md names classes that must exist

`.design-sync/conventions.md` is prepended to the uploaded README and read by the design agent.
Every class and token it enumerates is checked against the built `styles.css` closure before
upload. Two arbitrary-value classes had to be corrected: `rounded-[10px]` and `text-[13px]`
emit nothing, because the sheet is precompiled and nothing scanned at build time contained
them. `rounded-xl` already resolves to 10px (`--radius-xl: 0.625rem`); the closest real type
step is `text-sm`. Only `text-xs`/`text-sm`/`text-base`/`text-lg` exist. Re-run that check on
every sync - a class named there and absent from the sheet is worse than saying nothing,
because the agent will trust it and ship unstyled output.
