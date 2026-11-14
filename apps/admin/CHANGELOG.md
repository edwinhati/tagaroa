# @apps/admin

## 0.1.0

### Minor Changes

- f96cc63: ISSUE-101: Identity roles, permissions and refusal codes now come from one shared policy, so every app shows and enforces the same rules.

  - A temporary password is refused with `MUST_CHANGE_PASSWORD` (or `TEMPORARY_PASSWORD_EXPIRED`) on every route, including `/api/auth`, which used to say `PASSWORD_CHANGE_REQUIRED`.
  - Passwords must be at least 12 characters in every environment.
  - Confirming a privileged access review answers `{ data: { reviewed: true } }`.
  - Old admin addresses such as `/overview`, `/roles`, `/security` and `notifications?tab=` no longer redirect; links point at the admin home.
  - Admin asks you to sign in again whenever a change needs a recent sign-in, shows role names instead of role ids, and counts passkey sign-ins on the activity page.
  - The sign-in app now loads the shared shell styles.
  - The Frappe webhook refuses requests when its signing secret is empty.

### Patch Changes

- fc6e30d: Redesign three back-office screens to follow the design system:

  - **Work queue:** one list of the people who need attention, oldest first, each with its own action. Repeated recent events collapse into one line with a count.
  - **Person:** a single header line and one warning. Access, sign-in and activity move into tabs, beside a summary that states each sign-in fact once and says "Unavailable" when sessions can't be read.
  - **Notifications overview:** a one-sentence summary and one channels table with its delivery-log links. The volume chart appears only once something has been sent.

- 4797b80: Make resting input borders easier to see in dark mode (3.3:1 against the page and cards, up from 2.5:1), and set text on cards, popovers and secondary buttons in the same ink as primary actions.
- e542d48: ISSUE-103: Every app now builds and routes through `@repo/shell` (`@repo/shell/vite`, `@repo/shell/router`), and admin's paged tables share one URL state.

  - Admin's people list, delivery log and suppressions list read and write their filters the same way. The search box no longer drops a trailing space or resets while you type, keeps up with Back and Clear, and a stale or hand-edited link (an unknown sort, filter or page) opens the page instead of an error.
  - Changing the page size keeps the rows you were looking at in view on the people list too.
  - The suppression list offers every reason as a filter, not only those already present.
  - The people row menu says "Revoke all sessions" and the person page's menu says "Impersonate", matching each other.
  - Every app cancels its in-flight reads when the page is left, as the back office already did.

- a2a604b: ISSUE-118: Each app ships as its own image, on its own version. Deployed, an app works out its addresses from the host it is served from (`auth.`, `app.` and `admin.<base>`, the API at `<base>`), so the same image runs in every environment. Locally, the `VITE_` values still apply.
- cd24153: ISSUE-121: Each app is served by Caddy rebuilt with patched dependencies on an empty base image, which removes its critical and fixable high vulnerabilities.
- 6b24e69: ISSUE-54: Screen readers now announce a notification delivery row on small screens by the text it shows (message key, status, destination, channel and time) instead of a shorter label that left out the status.
- 6b24e69: ISSUE-54: Use valid loading markup for person sessions and announce table loading with an accessible status role.
- 919a4d2: ISSUE-59: A People row's action menu stays open on the right account while the search narrows the list, and a slow first load no longer re-renders the signed-in shell after a hydration mismatch.
- a9d2920: ISSUE-61: Session listings no longer return session tokens, and only a signed bearer token is accepted. Only a super administrator can list or revoke a privileged account's sessions. Revoking a single session now goes through core by session id and is recorded in the audit trail.
- cc4c01a: ISSUE-65: The audit trail now records notification template changes, lifted suppressions, single-session revocation, the end of impersonation, and subsidiary and team edits. Direct organization writes that bypassed the trail (invitations, member roles, team creation) are refused.
- c8b46cd: ISSUE-69: Update the editor sanitizer and HTTP parsers to address dependency security advisories.
- 12e9dff: ISSUE-90: Redesign the authenticator setup and recovery-code screens with a larger QR code, full-width actions, a copyable setup key and a two-column recovery-code list.
- 72ca3b5: ISSUE-51: People can change their own display name in Account settings. Email, role and the personal address stay admin-managed: the self-service update now refuses every other field, and each change is recorded in the identity activity trail.
- e542d48: Leaving a page while it is still checking your session no longer sends you to the sign-in page instead of where you were going (seen in Firefox).

  - When the sign-in service can't be reached, apps now show "This page didn't load" with a Try again button, instead of sending you to the sign-in page. Only a real "you're signed out" goes to sign-in.
  - Passkey and session errors in account settings show a readable sentence instead of the browser's raw network error.
  - Offboarding sends only the reason it asks for.
