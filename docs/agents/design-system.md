# Bringing a Claude Design screen into the repo

`packages/ui` is synced to Claude Design as **Tagaroa Design System**
(`https://claude.ai/design/p/d003b531-354d-4479-ae21-369465692da4`), so designs there are built
from these components on these tokens. Re-sync with `/design-sync`; `.design-sync/NOTES.md`
holds the build steps and traps.

Designs come back using a **flat** bundle (`const { Button } = window.TagaroaUI`). This repo
has **no root export** — `@repo/ui` alone does not resolve. Translate each name to the source
file it lives in, kebab-cased, and collapse siblings into one import:

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

One difference from the design canvas, expected: designs render on white while the apps render
on `--background` (warm bone).

`tagaroa.css` names `"Geist Variable"` / `"Geist Mono Variable"`, the families fontsource
actually ships. The package ships no CSS, so a new app has to
`@import "@fontsource-variable/geist"` and `geist-mono` in its own `app.css` to get the face —
it does not need to redeclare `--font-sans` (see `.design-sync/NOTES.md`).
