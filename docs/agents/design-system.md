# The design system and bringing a design into the repo

The **Tagaroa Design System** artifact (`https://claude.ai/artifact/DLitkQYccmvmD1fPnN9Xm1`) is
the published brand book: tokens in light and dark, the named rules, the Geist fonts, the mark,
and exports for design tools (W3C DTCG files for Figma, a CSS variables file for Pencil). Agents
read its `README.md` first. It mirrors `packages/ui/src/styles/tagaroa.css` and `DESIGN.md` and is
never the source of a value: change `tagaroa.css` first, mirror it in `DESIGN.md`, then update
the artifact and its exports.

The artifact carries no components. A design from any tool names components the way `@repo/ui`
exports them (`Button`, `CardHeader`). This repo has **no root export** — `@repo/ui` alone does
not resolve. Translate each name to the source file it lives in, kebab-cased, and collapse
siblings into one import:

```jsx
import { Button } from "@repo/ui/components/button";
import { Card, CardHeader, CardTitle } from "@repo/ui/components/card";
```

`Button` → `button`, `CardHeader` → `card`, `DropdownMenuItem` → `dropdown-menu`. Families
that are not guessable from the name:

| Exports                                                       | Import from                      |
| ------------------------------------------------------------- | -------------------------------- |
| `DataTableView`, `useDataTable`, every other `DataTable*`     | `@repo/ui/blocks/data-table`     |
| `ChartContainer`, `ChartTooltip`, `ChartLegend`, `ChartStyle` | `@repo/ui/components/chart`      |
| `InputOTP*`                                                   | `@repo/ui/components/input-otp`  |
| `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`    | `@repo/ui/components/resizable`  |
| `DirectionProvider`, `useDirection`                           | `@repo/ui/components/direction`  |
| `ThemeProvider`, `ThemeToggle`, `useTheme`, `themeBootScript` | `@repo/ui/blocks/theme`          |
| `Logo`                                                        | `@repo/ui/blocks/logo`           |
| `PasswordInput`                                               | `@repo/ui/blocks/password-input` |

Paste into a route under `apps/*` or `domains/*`: `apps/admin`, `apps/auth`, `apps/workspace`
and `domains/engineering` all import `@repo/ui/globals.css` and `@repo/ui/tagaroa.css` in their
own `src/styles/app.css`, so the markup is styled on arrival. No
provider is needed — components are class- and `data-`-attribute driven, and nothing in the
library reads context for its theme. The exceptions supply their own: `SidebarProvider`,
`ChartContainer`, `TooltipProvider`.

**Do not edit `packages/ui/src/components/` for product craft.** Those files are shadcn source
and get overwritten by `bunx --bun shadcn@latest add …`. Put Tagaroa tokens and Panel Rule /
compact density in `packages/ui/src/styles/tagaroa.css` (data-slot overrides), product
composition in `apps/*` or `domains/*`, and hand-owned primitives in `packages/ui/src/blocks/`.

`tagaroa.css` names `"Geist Variable"` / `"Geist Mono Variable"`, the families fontsource
actually ships. The package ships no CSS, so a new app has to
`@import "@fontsource-variable/geist"` and `geist-mono` in its own `app.css` to get the face —
it does not need to redeclare `--font-sans`.

## DESIGN.md

`DESIGN.md` at the repo root is the design language: tokens, named rules, component states, and
a token map to shadcn's variables. `tagaroa.css` is still the truth for values; change it first,
then mirror the change in `DESIGN.md` (see its Iteration guide).

The `shadcn` skill's "Design Systems from DESIGN.md" flow (`design-system.md` inside the skill)
scaffolds a **new standalone app** with `init --no-monorepo`. Do not run it in this repo. Use it
only to prototype a showcase page in a scratch directory. In the repo, the skill's token and
state mapping tables are a reference for editing `tagaroa.css` — never restyle
`packages/ui/src/components/` by hand.
