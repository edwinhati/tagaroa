# Dependency review

Reviewed 2026-11-01 for ISSUE-69 against the checked-in manifests and `bun.lock`.
Commands: `bun outdated`, `bun outdated --recursive`, `bun audit --json`, and
`bun pm ls --all`. Registry metadata was checked for every external locked package
to identify deprecated versions, duplicates, publication dates and major upgrades.
The host has Bun 1.4.4; installation compatibility is also checked with the repo's
pinned Bun 1.4.2. The three-day minimum release age stays enabled.

## Vulnerabilities

The initial audit reported 28 advisories across 11 package names. After the bumps
below it reports two advisories: one moderate and one low. An audit finding is a
dependency risk, not proof that an application route is exploitable.

| Package and initial locked version | Highest severity  | Dependency path / failure scenario                                                                                                                                                                    | Resolution                                                                                                                                                                                                                                                           |
| ---------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOMPurify 3.4.15                   | Critical          | Admin's Monaco editor pins this sanitizer; template/shadow-root and in-place sanitization can leave executable markup.                                                                                | Override to 3.4.17, a patch; remove override when Monaco updates its pin. [Advisories](https://github.com/advisories?query=dompurify)                                                                                                                                |
| Seroval 1.5.6                      | Critical          | TanStack devtools → Solid 1.9.15 → nested Seroval; crafted serialized values can invoke callables or exhaust resources. TanStack Start's separate 1.7.2 copy was already outside the affected ranges. | Solid 1.9.17 and its nested Seroval / plugins 1.6.12. [Callable advisory](https://github.com/advisories/GHSA-p6vx-979v-rg4c), [script injection](https://github.com/advisories/GHSA-9wx9-5pv9-3349)                                                                  |
| body-parser 2.3.0                  | High              | Nest → Express → compressed request body parsing can terminate the process on trailing bytes.                                                                                                         | 2.4.0 within Express's existing range. [Advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828)                                                                                                                                                                 |
| Multer 2.4.0                       | High              | Nest platform-express pins the multipart parser; pending asynchronous file filters after teardown can cause denial of service.                                                                        | Nest common/core/platform-express 12.3.2 brings Multer 2.5.0. [Advisory](https://github.com/advisories/GHSA-q7qp-rjg7-q26m)                                                                                                                                          |
| fast-uri 3.1.6                     | High              | Nest schematics → Angular devkit → AJV; authority/host confusion and normalization inconsistencies can affect URI validation.                                                                         | Backported fixes in 3.1.9; retain major 3. [Authority injection](https://github.com/advisories/GHSA-qw65-cvwx-89v3), [scheme spoofing](https://github.com/advisories/GHSA-w74x-v6f9-j3xg)                                                                            |
| js-yaml 4.3.1                      | High              | e2e tooling → xmlbuilder2 → YAML parser; empty merge sources bypass CPU limits.                                                                                                                       | Backport 4.3.2; retain major 4. [Advisory](https://github.com/advisories/GHSA-2883-xcg3-v3hh)                                                                                                                                                                        |
| source-map-js 1.2.1                | High              | Tailwind tooling uses the older copy; malicious indexed source-map offsets can block the event loop.                                                                                                  | 1.2.2; PostCSS's separate 1.2.2 entry stays unchanged. [Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)                                                                                                                                                 |
| Zod 4.6.1                          | High              | Root exploration tool `e2e` pins this older copy; oversized constrained collections can exhaust memory. Application copies were already 4.6.7.                                                        | Override to 4.6.7; remove when e2e updates its pin. [Advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)                                                                                                                                                    |
| qs 6.15.3                          | Moderate          | Nested body-parser copy can bypass array limits or throw on attacker-controlled properties. Express's 6.16.1 copy was already fixed.                                                                  | Nested copy 6.16.1. [Array limit](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [stringify](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw)                                                  |
| esbuild 0.18.20                    | Moderate, remains | drizzle-kit → deprecated esm-loader → core-utils → esbuild. Its development server can expose responses to another website. The separate 0.25.12 and 0.28.2 copies are not affected.                  | core-utils requires `~0.18.20`; a safe patch cannot reach the fix in 0.25.0. Await a Drizzle tooling replacement; avoid exposing the affected serve mode. [Advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99)                                              |
| Deepmerge 4.3.1                    | Low, remains      | React Email render → html-to-text → deepmerge can poison returned object prototypes.                                                                                                                  | Registry latest is still 4.3.1; no patched release available at review time. Upgrading only the direct renderer leaves the component bundle's nested renderer. Follow up on the email dependency tree. [Advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) |

## Applied patch and minor updates

| Direct dependency                                      | Before → after    | Scope                                                                |
| ------------------------------------------------------ | ----------------- | -------------------------------------------------------------------- |
| @types/node                                            | 26.6.5 → 26.6.6   | Root, admin, auth, workspace, engineering, UI and core, kept aligned |
| @nestjs/common, @nestjs/core, @nestjs/platform-express | 12.2.0 → 12.3.2   | Core; removes the vulnerable Multer pin                              |
| @nestjs/schematics                                     | 12.0.10 → 12.0.12 | Core tooling                                                         |
| oxfmt                                                  | 0.74.0 → 0.75.0   | Root tooling                                                         |
| oxlint                                                 | 1.89.0 → 1.90.0   | Root tooling                                                         |

Security-only transitive bumps are listed above. Required dependencies of the Nest
bumps also change: Angular devkit core/schematics 22.2.3 → 22.2.4, file-type
22.1.1 → 22.2.0, tokenizer/inflate 0.4.1 → 0.5.2, strtok3 10.3.5 → 10.6.3 and
uint8array-extras 1.5.0 → 1.6.0. The formatter/linter native bindings follow their
parent versions. No major version is upgraded.

The two root overrides deliberately replace exact vulnerable transitive pins.
Other security bumps stay within their parents' ranges. Lockfile format remains
version 2. Every entry for an unbumped package is preserved byte-for-byte; this
includes duplicate entries that could otherwise be deduplicated by a fresh solve.

No authorization source, Better Auth configuration, `AccessControlModule`,
`admit()` or `isDomainAdmin` logic changes. Nest runtime dependencies do change,
so database integration and Chromium browser tests are required alongside QA.

## Outdated packages retained

The recursive scan includes root plus all app, domain, package and server
workspaces. Its `Latest` column is filtered by minimum release age; `*` does not
mean the registry's true latest version. In particular, the registry has Postgres
4.0.0 even though age-filtered `bun outdated` shows 3.4.9.

| Retained dependency                                    | Observed candidate               | Reason                                                                                                                                    |
| ------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| @react-email/render 2.1.1                              | 2.2.0                            | Adds html-to-text 10, a transitive major change; the deprecated components bundle also pins render 2.0.6. Review the email tree together. |
| Better Auth family / auth 1.7.12                       | 1.7.15 registry latest           | Recent releases; retain coordinated existing versions and minimum release age.                                                            |
| @tanstack/react-query and query-devtools 5.104.5       | 5.105.1 registry latest          | Recent releases; preserve query/devtools alignment.                                                                                       |
| @tanstack/devtools-vite 0.8.5 / react-devtools 0.10.13 | 0.8.6 / 0.10.14                  | Within the three-day quarantine at review time.                                                                                           |
| ai 7.0.152 / @ai-sdk/openai-compatible 3.0.77          | 7.0.159 / 3.0.82 registry latest | Recent releases; leave the exploration SDK family together.                                                                               |
| e2e 0.21.3 / @e2e-dev/web 0.15.3                       | 0.22.0 / 0.15.4                  | Recent releases; security fix uses a Zod patch override instead of bypassing quarantine.                                                  |
| lucide-react 1.61.0                                    | 1.66.0 registry latest           | Recent release; optional icon churn deferred.                                                                                             |
| cn 0.5.0 / react-resizable-panels 4.15.0               | 0.5.1 / 4.16.1 registry latest   | Preserve existing UI behavior; candidates held by minimum release age.                                                                    |

## Deprecated and duplicated dependencies

The npm registry explicitly deprecates `@react-email/components@1.0.12` and its
individual body, button, code-block, code-inline, column, container, font, head,
heading, hr, html, img, link, markdown, preview, row, section, tailwind and text
packages as unsupported. This is a runtime email dependency. A follow-up should
replace the deprecated bundle with a supported upstream path and verify HTML and
plain-text output. This review does not infer abandonment solely from an old
publication date.

`@esbuild-kit/core-utils@3.3.2` and `@esbuild-kit/esm-loader@2.6.5` are deprecated
as merged into tsx. They arrive through drizzle-kit; replacing the parent tooling
is preferable to pretending its old esbuild range supports a current version.
See [registry metadata](https://registry.npmjs.org/@esbuild-kit%2fcore-utils) and
[React Email metadata](https://registry.npmjs.org/@react-email%2fcomponents).

There are **no conflicting direct dependency declarations across workspaces**:
every shared package name has the same declared version/range. For example,
Better Auth 1.7.12, React 19.3.1, TypeScript 7.0.2, Vite 8.3.5 and Zod 4.6.7 are
aligned. Tailwind's different package names have different range styles (`^4`
and `^4.3.3`), but resolve to the same 4.3.3 family.

The initial lockfile contains these duplicated logical packages; native platform
companions are grouped with their parent. These are transitive version splits,
not conflicting workspace declarations. Preserve them unless a parent upgrade
and its checks justify consolidation.

| Family                                 | Initial locked versions                         |
| -------------------------------------- | ----------------------------------------------- |
| @ai-sdk/provider; @better-fetch/fetch  | 4.0.33 / 4.0.28; 1.3.2 / 1.3.1                  |
| @jridgewell/sourcemap-codec            | 1.5.5 / 1.6.0                                   |
| @react-email/render                    | 2.1.1 / 2.0.6                                   |
| @tanstack/devtools-event-client        | 0.5.0 / 0.4.4                                   |
| @tanstack/react-store; @tanstack/store | 0.11.1 / 0.11.2 each                            |
| cn; dotenv; es-toolkit                 | 0.5.0 / 0.4.0; 17.4.2 / 18.0.3; 1.51.0 / 1.52.0 |
| esbuild and native binaries            | 0.25.12 / 0.18.20 / 0.28.2                      |
| lightningcss and native binaries       | 1.33.0 / 1.32.0                                 |
| magic-string; marked                   | 0.30.21 / 1.4.1; 14.0.0 / 15.0.12               |
| media-typer; mime-db; mime-types       | 1.1.1 / 0.3.0; 1.54.0 / 1.52.0; 3.0.2 / 2.1.35  |
| nanoid                                 | 3.3.20 / 3.3.18                                 |
| oxc-parser and native bindings         | 0.148.0 / 0.120.0 / 0.154.0                     |
| @oxc-project/types                     | 0.148.0 / 0.155.0 / 0.120.0 / 0.154.0           |
| postcss; powershell-utils              | 8.5.31 / 8.5.26; 0.2.0 / 0.1.0                  |
| qs; reselect; semver                   | 6.16.1 / 6.15.3; 5.2.0 / 5.3.0; 7.8.5 / 6.3.1   |
| seroval; seroval-plugins               | 1.7.2 / 1.5.6 each                              |
| source-map; source-map-js              | 0.7.6 / 0.8.0 / 0.6.1; 1.2.1 / 1.2.2            |
| tslib; type-is                         | 2.8.1 / 1.14.1; 2.1.0 / 1.6.18                  |
| undici-types; use-sync-external-store  | 8.9.0 / 8.3.0; 1.6.0 / 1.7.0                    |
| zod                                    | 4.6.7 / 4.6.1                                   |

The security updates align qs and source-map-js versions and eliminate the old
Zod copy. Seroval's separate 1.6.12 and 1.7.2 lines remain valid for their parents.

## Major upgrades observed, not applied

| Package                             | Candidate                       | Observed breaking changes and follow-up                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| postgres 3.4.9 (core devDependency) | 4.0.0                           | Defaults to server-inferred parameter types; Date/timestamp behavior changes, ambiguous parameters need casts; `sql.array()` is removed; rolled-back transactions reject; ESM-only distribution and Node ≥20; TypeScript imports change. Check migration scripts, transactions and time-zone-sensitive queries before upgrading. [Official release](https://github.com/porsager/postgres/releases/tag/v4.0.0) |
| fast-uri 3.1.6 (transitive)         | 4.2.3                           | v4 removes deprecated TypeScript types and changes escaping. Keep AJV's major-3 range and use the 3.1.9 security backport. [Official v4 release](https://github.com/fastify/fast-uri/releases/tag/v4.0.0)                                                                                                                                                                                                     |
| js-yaml 4.3.1 (transitive)          | 5.5.0                           | Default loader switches to CORE_SCHEMA without merge tags, `!!set` returns Set, empty input throws, Type/Schema APIs change and internal lib imports disappear. Keep xmlbuilder2's major-4 range with 4.3.2. [Official changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md)                                                                                                                 |
| html-to-text 9.0.5 (transitive)     | 10.0.1 required by render 2.2.0 | New major would enter through a renderer minor. No compatibility conclusion established here; review the upstream diff and email output before accepting it.                                                                                                                                                                                                                                                  |

These are the observed direct major candidate and security/upgrade-relevant
transitive majors, not a recommendation to upgrade every transitive package to
its registry latest. No prerelease migration or override across majors is applied.

## Validation

- Local-ci `local-ci-36-j1`, QA `checks`: frozen install, lint, types, unit tests
  and all five builds passed. As documented in the local-ci skill, `workflows`
  paused at database integration because its container lacks Docker Compose;
  `local-ci-36-j2` was aborted after `checks` succeeded.
- `bun run boundaries`: 400 files in 11 packages, no issues.
- Host database integration: the first shared-database run passed the fresh
  migration/restore test but subsequently suffered container recreation and
  administrator-terminated connections during the soak test. Reran against a
  dedicated Compose project on port 15469 with `TEST_DATABASE_URL` and Turbo
  `--env-mode=loose`: 55 passed, zero failed. Its existing environment guard skips
  the migration/restore case, whose passing first-run result is recorded above.
- Host Chromium suites, sequentially: auth 9 passed, admin 24 passed, including
  Monaco template editing and preview. Another checkout occupied the suites'
  fixed ports, so temporary copies changed only port numbers (130xx → 230xx,
  18080 → 28080) in the configurations and specs; assertions were preserved.
  These copies are not committed. Both suites used the dedicated database.
- Bun 1.4.2 frozen install passed on the final lockfile. Lock comparison verifies
  all 872 unbumped package entries are byte-for-byte unchanged; all version
  changes retain their major version. Changed manifests and documentation pass
  formatter checks; `git diff --check` passes.
- Final audit: Deepmerge (low) and old esbuild (moderate) remain as documented.
  WebKit, Firefox, mobile Chromium and deployed-environment tests were not run.
