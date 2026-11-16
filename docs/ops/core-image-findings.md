# core-service image: scanner findings

Reasons to cite when acknowledging findings on `core-service` in Artifact Keeper
(ISSUE-131; scan of `core-service:0.2.0`, 2026-11-16). Acknowledging is a human step.

## `golang.org/x/text` (CVE-2026-56852): fixed in the image

It was compiled into TypeScript 7's native `tsc`. TypeScript reached the production
install only as a peer dependency of `@thallesp/nestjs-better-auth`, which never loads
it. The `deps` stage in `servers/core/Dockerfile` now deletes `typescript` and
`@typescript/*` after the production install, so no Go binary ships. (`--omit=peer`
would also drop `react-dom`, which email rendering needs.)

## glibc `libc6` 2.41-12+deb13u4 (Debian 13): no fix in any `oven/bun` tag

`1.4.4-distroless` is the newest tag and its digest is the one pinned. Debian trixie
marks all three highs `no-dsa` (minor), so a rebuild will not pick up a fix; revisit
when Debian ships one or `oven/bun` moves to a newer base. Core runs Bun on the stock
glibc, takes requests only through Pangolin, and has no shell in the image.

| CVE            | What it is                                                                                             | Why it does not apply to core                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CVE-2026-19499 | `strfmon`/`strfmon_l` writes past the buffer with right-justified width padding                        | Only reachable by a program calling `strfmon`. Neither Bun's runtime nor core formats currency through libc; money formatting is JS `Intl`. No network-facing impact is known.                                                                                   |
| CVE-2026-5435  | deprecated resolver debug printers (`ns_printrr`, `ns_printrrf`, `fp_nquery`) ignore the buffer length | Debugging helpers that nothing in Bun or core calls; DNS goes through Bun's resolver or `getaddrinfo`.                                                                                                                                                           |
| CVE-2026-84243 | `gettext` loads message catalogs from a path built from the `LANGUAGE` env var                         | Needs an attacker who sets `LANGUAGE` and `LANG`/`LC_ALL` in the process environment, and plants a `.mo` file. Core's environment is set by the deploy, not by requests, there is no SSH or shell in the image, and nothing in core calls `setlocale`/`gettext`. |

These are reasoned from the advisories and Debian's tracker, not from inspecting the
Bun binary's symbol table. The medium, low and info glibc findings are Debian's
own minor/unfixed entries with the same absence of a fix; none has a fixed version to
move to.
