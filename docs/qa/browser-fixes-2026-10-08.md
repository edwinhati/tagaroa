# Browser findings closed

Scope: the three findings left open in the previous QA update, plus their regression checks.

| Finding                                                         | Resolution                                                                                                                                                         | Evidence                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Recovery codes announced as “Authenticator”                     | The accessible name now matches the action. Setup is named “Set up authenticator.”                                                                                 | Ego mobile snapshot announced “Recovery codes”; E2E finds the button by that name.             |
| Sign-in loses its cookie when an old session is revoked         | The audit hook uses the newly authenticated session or the session already established by middleware. It no longer rereads the old request cookie after the write. | Revoked-cookie E2E; Ego confirmed the cookie was replaced and the resulting session was valid. |
| Passkey registration remained unverified after a device timeout | Registration, sign-in, and removal are covered with a virtual authenticator. Cancellation and timeout now show a retry instruction.                                | E2E completes all three operations and checks cancellation feedback.                           |

The MFA regression also checks password rejection, invalid authenticator codes, manual setup, ten recovery codes, acknowledgment before continuing, recovery-code reuse rejection, trusted-device login, and admission to workspace.

## Antislop delivery gate

- Hard gate PASS for these edits: no assets, fabricated claims, navigation, colors, or layout treatments were added. The changed action has a real handler, a matching accessible name, and a 44px mobile target measured in Ego. Device errors have visible text.
- Purpose gate PASS: account settings uses the shared controls and their existing motion. Local button motion overrides were removed after lint identified them.
- Liveliness PASS: the existing warm-ground direction and ENERGY 1 / RHYTHM 2 / MOTION 1 are retained. This patch adds no new visual composition.
- Craftsmanship PASS: keyboard activation and Escape were exercised; regression checks cover success and rejection paths; targeted lint and formatting pass. Existing color tokens were preserved; this patch does not claim a new whole-product contrast audit.
- Copywriting PASS: the timeout message names the failed action and the next step, without browser specification links or invented claims.

## Reproduce

Results: 8 E2E scenarios passed, followed by a second successful auth run (4 scenarios). All 80 targeted unit tests and 9 workspace type checks passed. Targeted lint, formatting, and `git diff --check` passed.

```sh
bun run test:e2e
bun test apps/auth/src apps/admin/src packages/shell/src servers/core/src/modules/auth/auth.test.ts
bun run check-types
```

Passkey evidence uses a virtual authenticator. Physical security keys and native device prompts still need testing on those devices.
