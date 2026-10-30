# HR systems for a multi-entity, multi-country group

Research date: 2026-10-26. Primary sources only (vendor sites, developer docs, help centres, GitHub repositories). Where a vendor page could not be read or did not state a fact, this note says "not confirmed". Prices are as shown on the cited page on 2026-10-26. None of the vendor pages cited show a publication date unless noted.

## 1. Summary

- **Top pick: Deel.** It runs payroll for a company's own entities and offers Employer of Record (EOR) in one account. It publishes an HRIS price ($5 per employee per month for Deel HR Core). Webhooks are signed with HMAC-SHA256 and cover worker create, update and delete plus contract termination. It also exposes a SCIM 2.0 _read_ API carrying `active`, `startDate`, `endDate`, manager and legal entity, which is close to what Tagaroa needs for an automated monthly diff.
- **Runner-up: Remote.** It publishes own-entity payroll at $29 per employee per month, delivers payroll in-house and supports multiple legal entities in one account. Its webhooks are HMAC-SHA256 signed and include a timestamp. Its published core-HR detail and HRIS pricing are thinner than Deel's.
- **No vendor tested pushes outbound SCIM to a custom app except Rippling.** Rippling would map directly onto `@better-auth/scim`, but it does not publish its own-entity payroll country list, and its customer-facing event webhooks are partner-only.
- **Open source** can hold core HR records, with Frappe HR the strongest fit. No open-source option maintains statutory payroll for more than a handful of countries, so payroll would still go to local bureaus or an EOR.

## 2. What Tagaroa needs

From [access-operations.md](../security/access-operations.md) and [ADR 0001](../adr/0001-admin-managed-accounts.md):

- Several subsidiaries, each a separate legal entity, employing staff in several countries. Group size: tens to a few hundred people.
- One system that becomes the source of truth for **employment** status (join, transfer, leave), replacing the people-operations lead's restricted roster and the manual monthly reconciliation.
- Events must flow **HR system → Tagaroa**. Tagaroa (`servers/core`, Better Auth) stays the identity provider and access-control source of truth. On join it runs admin issuance (`POST /admin/create-user` with `personalEmail`, a temporary password and an onboarding email). On transfer it changes subsidiary and team membership. On leave it runs "Offboard employee" (`POST users/:userId/offboard`), which suspends the identity and removes memberships, sessions and business grants, and writes the audit log.
- The HR system must expose the employee's **personal email**, because issuance refuses to fall back to the workspace address.
- The integration options are SCIM pushed into `@better-auth/scim`, a webhook endpoint in `servers/core`, or a scheduled API poll. SCIM support _inbound_ to the HR tool (an IdP provisioning into it) does not help.

## 3. Comparison table

| Vendor       | Payroll model and coverage                                                                                                             | Multi-entity in one account                                                                                                                          | Outbound to a custom app (SCIM / webhooks / API)                                                                                                                                                                                                                           | Pricing (as of 2026-10-26)                                                                | Fit                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Deel**     | Own-entity Global Payroll plus EOR (130+ countries). Global payroll page says "150+ countries" but does not split own-entity from EOR. | Implied: onboarding step "select countries, entities, and payroll owners". Its SCIM user record carries `costCenter` as the legal-entity identifier. | SCIM: Deel is a SCIM **server** (read/write API), not a pusher. Webhooks: yes, HMAC-SHA256, worker v2 created/updated/deleted, `contract.terminated`, 10 retries. API: bearer token, 5 req/s per organization.                                                             | Deel HR Core from $5/employee/month. EOR from $599. Global Payroll price not on the page. | Strong                                           |
| **Remote**   | Own-entity Global Payroll in-house, "100+ countries". EOR 90+ countries.                                                               | Yes (help article).                                                                                                                                  | SCIM outbound: not confirmed. Webhooks: yes, HMAC-SHA256 with timestamp; `employment.onboarding.completed`, `employment.status.updated`, `offboarding.completed` and others. API: company-scoped bearer token. Rate limits not stated.                                     | Global Payroll from $29/employee/month. EOR from $599. HRIS price not confirmed.          | Strong                                           |
| **Rippling** | Own-entity Global Payroll and native EOR. Country count not published.                                                                 | Multiple entities "in multiple countries" mentioned, no detail.                                                                                      | SCIM: **yes, outbound**. Custom apps can be provisioned "with JIT or SCIM" (plan not stated). Webhooks: event webhooks are App Shop partner-only; customers get "Webhooks in Workflows". API: v2 REST, bearer token. Rate limits not confirmed.                            | From $8/employee/month plus base fee. Global Payroll and EOR are contact sales.           | Good on integration, unclear on payroll coverage |
| **HiBob**    | Native US and UK payroll. Elsewhere through Payroll Hub to external providers.                                                         | Not confirmed from a primary source.                                                                                                                 | SCIM outbound: not confirmed. Webhooks: yes, HMAC-SHA512, `employee.joined` / `employee.left` fire **on the effective date**. API: service user, per-endpoint limits (e.g. 50/min on people search).                                                                       | Not public (demo form only).                                                              | Good if entities are mostly UK/US                |
| **Personio** | Native payroll country list not confirmed (vendor site blocked fetches).                                                               | Legal entities exist as an API resource (`/v2/legal-entities`). A 412 means the feature is not enabled.                                              | SCIM outbound: not confirmed. Webhooks: yes, HMAC-SHA256 with timestamp; `employment.started` / `employment.terminated` effective-date events; `employment.updated` covers subcompany, department and supervisor changes. API: client credentials, token endpoint 150/min. | Not confirmed (pricing page blocked).                                                     | Good if entities are mostly in Europe            |
| **Workday**  | Native payroll in Australia, Canada, France, Ireland, UK and US. 180+ countries through certified partners.                            | Not confirmed from a readable primary page.                                                                                                          | SCIM outbound: not confirmed. No webhooks. Outbound means building a Workday integration (Studio, Orchestrate, integration subscriptions).                                                                                                                                 | Not public.                                                                               | Poor (built for enterprises)                     |
| **BambooHR** | Payroll for US employees only. Global employment add-on "powered by Remote".                                                           | BambooHR's own guidance leans to one account per company/EIN.                                                                                        | SCIM outbound: not confirmed. Webhooks: yes, `employee.created/updated/deleted`, HMAC-SHA256. API: API key over Basic auth, or OAuth.                                                                                                                                      | Core $10, Pro $17, Elite $25 per employee/month. Flat $250/$425/$650 for up to 25 people. | Poor for multi-country                           |
| **Oyster**   | EOR in 180+ countries. Own-entity payroll not confirmed (the global-payroll page describes EOR only).                                  | Not confirmed.                                                                                                                                       | SCIM outbound: not confirmed. Webhooks: yes (offboarding, contract change, payments, invoicing). No hire event found. API: OAuth.                                                                                                                                          | EOR $699/employee/month. Contractors $29/month.                                           | Good only if EOR-heavy                           |

Considered but not tabled: Factorial has `employee_created`, `employee_terminated` and `employee_unterminated` webhooks ([Factorial API](https://apidoc.factorialhr.com/docs/webhook-employee-terminated)), but its multi-country payroll was not researched. Papaya Global documents webhooks ([Papaya docs](https://docs.papayaglobal.com/api-reference/webhooks-notifications)), but its public event list is gated. Multiplier was not assessed.

## 4. Per-vendor notes

**Deel.** Payroll runs on your own entities, with EOR and contractors on the same worker profile ([Deel HR](https://www.deel.com/hr/), [Global Payroll](https://www.deel.com/global-payroll/)). EOR covers 130+ countries and starts at $599 per employee per month ([pricing](https://www.deel.com/pricing/)). Deel HR Core starts at $5 per employee per month and includes worker profiles, org chart, time off, job architecture, workflows and approvals ([Deel HR](https://www.deel.com/hr/)).

Webhooks are POSTs signed in `x-deel-signature` as `HMAC-SHA256(signing_key, "POST" + raw_body)`, with `x-deel-hmac-label` naming the key. Deel retries 10 times over about a day, then disables the subscription ([webhooks intro](https://developer.deel.com/api/webhooks/introduction)). The signature covers no timestamp, so replay protection has to come from deduplicating on `meta.event_id`.

HRIS events include Worker V2 Created, Updated and Deleted. Updated covers "profile, contract, compensation, address, phone, custom fields, or position" ([worker v2 updated](https://developer.deel.com/api/stable/hris-endpoints/hris/webhook-worker-v-2-updated.md)). Contract Terminated fires "when a contract termination is completed" for contractor, EOR and Global Payroll contracts, carrying `completion_date` ([contract terminated](https://developer.deel.com/api/stable/endpoints/terminations/webhook-contract-terminated.md)). Whether that is the effective last day or the date the termination was processed is **not confirmed**.

The SCIM API makes Deel a SCIM service provider. Its User resource carries `active`, `department`, `manager`, `costCenter` ("legal entity identifier"), `startDate`, `endDate` and `hiringStatus`. It is "available exclusively to Deel clients and partners" ([SCIM overview](https://developer.deel.com/api/scim-api/overview)). Deel's own identity-provider guide has the customer's code read Deel and write to the IdP, using webhooks plus a periodic full sync ([sync guide](https://developer.deel.com/api/hris-common-use-cases/sync-deel-users-to-identity-providers)). Rate limit: 5 requests per second per organization, with no rate-limit headers ([rate limits](https://developer.deel.com/api/stable/rate-limits.md)). Caveats: personal email is not listed among the SCIM core attributes, so it would come from the HRIS People API (not confirmed which field). The Global Payroll price is not public.

**Remote.** Global Payroll is for "countries where you own the entity", starting at $29 per employee per month with no base fee. EOR starts at $599 in 90+ countries ([pricing](https://remote.com/pricing)). Remote says it "runs payroll across 100+ countries" and "builds the platform, runs the compliance systems, and employs the specialists" ([global payroll](https://remote.com/global-hr/global-payroll)). Multiple legal entities can be managed from one account ([help](https://support.remote.com/hc/en-us/articles/31914612274189-Creating-and-managing-multiple-entities-in-one-company-account)).

Webhooks are registered per company with a company-scoped bearer token, and the signing key is returned once ([subscribing](https://developer.remote.com/docs/subscribing-to-webhooks)). Verification is HMAC-SHA256 over the signing key, raw body and `X-Remote-Timestamp`, compared with `X-Remote-Signature` ([verifying](https://developer.remote.com/docs/verifying-webhooks)). Remote's sync guide recommends `employment.updated`, `employment.details.updated`, `employment.status.updated`, `employment.work_email.updated` and others ([sync guide](https://developer.remote.com/docs/sync-workforce-data)). `employment.onboarding.completed` fires when the employment becomes active ([reference](https://developer.remote.com/reference/employmentonboardingcompleted)), and `offboarding.completed` when an offboarding request completes ([reference](https://developer.remote.com/reference/offboardingcompleted)).

Caveats: the HRIS feature set and price, the org chart and reporting-line support, and the API rate limits were not confirmed from Remote's own pages. Whether `offboarding.completed` fires on the last working day is also not confirmed.

**Rippling.** Rippling's IAM product lets admins "build custom integrations to provide SSO with SAML, provisioning with JIT or SCIM" and revoke access on termination ([IAM](https://www.rippling.com/products/it/identity-access-management)). That is outbound SCIM into an app like Tagaroa. Which plan includes it is not stated.

Rippling's developer index says App Shop webhooks (`employee.created`, `employee.updated`, `employee.hired`, `employee.terminated`, about 5-minute lag, bearer auth) are "Partner-only". Customers get in-product webhooks and workflows instead. Customer API tokens are bearer tokens that are revoked if the owner is terminated or the token goes unused for 30 days ([llms.txt](https://developer.rippling.com/llms.txt)). The detailed developer pages render client-side and could not be read, so rate limits are **not confirmed**. On the platform tiers page, "Webhooks in Workflows" exists, but the Core tier "supports onboarding event triggers only" ([tiers](https://www.rippling.com/en-AU/rippling-platform-tiers)).

Pricing starts "at $8 per employee per month" plus a base fee. Global Payroll and EOR are contact sales ([pricing](https://www.rippling.com/pricing)). Own-entity payroll is offered ("run payroll for employees globally via your own entities"), but no country count is published ([global payroll](https://www.rippling.com/global-payroll-and-hiring)).

**HiBob.** Native payroll covers the US ("all 50 states") and the UK ("HMRC-compliant"). Payroll Hub connects to external providers such as ADP WFN, Paylocity, TriNet and Xero ([payroll](https://www.hibob.com/features/payroll/)). The pricing page is a demo form with no figures ([pricing](https://www.hibob.com/pricing/)).

The webhooks have the best lifecycle semantics of any vendor here. `employee.joined` and `employee.left` (terminated or garden leave) fire once the lifecycle entry becomes effective, automatically at midnight on the effective date. `employee.access.revoked.immediately` covers a termination flow with "Revoke access immediately" selected ([employee events](https://apidocs.hibob.com/reference/employee-data-webhooks)). Signature: HMAC-SHA512, Base64-encoded, in `Bob-Signature`. Retries run for 3 days ([webhooks](https://apidocs.hibob.com/reference/getting-started-webhooks)). Rate limits are per endpoint, for example 50 per minute on people search ([rate limit](https://apidocs.hibob.com/docs/rate-limit)). Multi-entity support and outbound SCIM to a custom app were not confirmed from HiBob sources.

**Personio.** Webhooks cover `person.*`, `employment.created/updated/deleted/started/terminated`, absences and documents. They are signed with HMAC-SHA256 over `{timestamp}.{raw_body}`, with a 3-second acknowledgement window and retries for up to 3 days ([webhooks](https://developer.personio.de/reference/webhooks)). `employment.started` and `employment.terminated` fire "on the date of the employment start and/or termination" ([changelog](https://developer.personio.de/changelog/webhooks-effective-date-notification-webhooks-employmentstarted-and-employmentterminated), undated). Personio also says repetitive polling isn't permitted where webhooks exist ([event-driven guide](https://developer.personio.de/docs/event-driven-data-from-personio)). Legal entities are an API resource ([list legal entities](https://developer.personio.de/reference/listlegalentities)). The token endpoint allows 150 requests per minute ([auth](https://developer.personio.de/reference/authentication)). personio.com returned HTTP 429 or a bot challenge on every attempt, so native payroll countries, pricing and plan gating are **not confirmed**.

**Workday.** Native payroll is available in Australia, Canada, France, Ireland, the UK and the US, per Workday's own pages. Other markets go through certified partners "across more than 180 countries" ([global payroll](https://www.workday.com/en-us/products/payroll/global-payroll.html)). Outbound flows are integrations you build in Workday, such as Orchestrate outbound integrations and integration subscriptions on web-service requests ([outbound integration](https://developer.workday.com/doc/GUID-0c99dd81-6964-4adf-90d7-f27402c5fc9a.md), [integration subscriptions](https://developer.workday.com/doc/jas1395101817299.md)). No public pricing page was found. For tens to a few hundred staff, this is more system than Tagaroa needs.

**BambooHR.** Core is $10, Pro $17 and Elite $25 per employee per month (the FAQ quotes $10.25 and $17.50). Payroll is "US employees only". Global employment is "powered by Remote" ([pricing](https://www.bamboohr.com/pricing/)). Webhooks are signed HMAC-SHA256 in `X-BambooHR-Signature`, with up to 5 retries ([webhooks](https://documentation.bamboohr.com/docs/webhooks)). Events are `employee.created`, `employee.updated` (monitored fields only) and `employee.deleted` ([event-based](https://documentation.bamboohr.com/docs/event-based-webhooks)). BambooHR recommends one account per company/EIN for payroll ([payroll FAQ](https://bamboohr.screenstepslive.com/m/84572/l/1638061-managing-multiple-companies-with-payroll-faq)), which works against a multi-entity group.

**Oyster.** EOR costs USD 699 per employee per month ([pricing](https://www.oysterhr.com/pricing)). Webhooks released in May 2025 cover offboarding (including `offboarding.engagement_terminated`), contract changes, payments and invoicing ([changelog](https://docs.oysterhr.com/changelog/oyster-api-updates-26-may-2025)). Setup needs a developer application and access token ([webhooks guide](https://docs.oysterhr.com/docs/getting-started-with-webhooks)). No hire or start event was found. Own-entity payroll coverage and price could not be confirmed from Oyster's pages.

## 5. Free and open-source options

Repository data is from the GitHub API on 2026-10-26. "Commits in 2026" counts commits on the default branch since 2026-01-01.

| System                | Licence                                                                   | Payroll in the free edition / localizations                                                                                                            | Multi-company                                                                       | Outbound integration                                                                                                                                | Health (latest release, 2026 commits)           | Stack                                         |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| **Frappe HR**         | GPL-3.0                                                                   | Yes: salary structures, tax slabs, payroll runs. In-repo regional code for **India** and **UAE** only.                                                 | Yes, through ERPNext Companies (required app), including parent/child subsidiaries. | Webhooks on document events, optional HMAC-SHA256 in `X-Frappe-Webhook-Signature`. REST API with token auth. No SCIM.                               | v16.52.0 (2026-10-22). About 2,300 commits.     | Python, Node, MariaDB 11.8 or Postgres, Redis |
| **Odoo Community**    | LGPL-3.0                                                                  | **No Payroll app**: no `hr_payroll` module in Community 19.0. Payroll and its localizations (AU, BE, IN, MX, US, UAE and others) come with Enterprise. | Yes (core multi-company).                                                           | "Send Webhook Notification" action exists in core, but it is unsigned, has a 1-second timeout and is fire-and-forget. JSON-2 external API. No SCIM. | 19.0 series. About 14,500 commits.              | Python, PostgreSQL                            |
| **OrangeHRM Starter** | GPL-3.0                                                                   | No payroll. Payroll connector appears in the paid Advanced edition only.                                                                               | Not confirmed.                                                                      | REST API (`EmployeeAPI` in PIM plugin). Webhooks only post notifications to Slack, Teams or Google Chat. No SCIM.                                   | v5.9 (2026-06-28). 31 commits, last 2026-03-30. | PHP, MySQL                                    |
| **Horilla**           | LGPL-2.1                                                                  | Yes, a generic payroll module. No country localizations documented.                                                                                    | `Company` model in core.                                                            | REST API with JWT bearer only. No outbound webhooks found. No SCIM.                                                                                 | 2.2.0 (2026-10-21). About 2,000 commits.        | Python/Django, PostgreSQL 16, Redis, nginx    |
| **IceHrm**            | **Elastic License 2.0**: source-available, not an OSI open-source licence | Payroll code with sample data for Ghana and Sri Lanka. Maintenance not confirmed.                                                                      | Not confirmed.                                                                      | REST endpoints (`RestApiManager`). No outbound webhooks found. No SCIM.                                                                             | v36.0.1 (2026-10-01). 70 commits.               | PHP, MySQL 8                                  |

Notes and citations:

- **Frappe HR.** Features and licence: [repo](https://github.com/frappe/hrms). Requires ERPNext: [hooks.py](https://github.com/frappe/hrms/blob/develop/hrms/hooks.py) (`required_apps`). Regional folders: [hrms/regional](https://github.com/frappe/hrms/tree/develop/hrms/regional). ERPNext guidance is "use a parent and child structure for subsidiaries" ([company setup](https://docs.frappe.io/erpnext/company-setup)). Webhooks: [Frappe docs](https://docs.frappe.io/framework/user/en/guides/integration/webhooks). REST and token auth: [Frappe docs](https://docs.frappe.io/framework/user/en/api/rest). Stack: [installation](https://docs.frappe.io/framework/user/en/installation).
- **Odoo.** The [LICENSE](https://github.com/odoo/odoo/blob/19.0/LICENSE) is LGPLv3. The 19.0 `addons/` tree in [odoo/odoo](https://github.com/odoo/odoo/tree/19.0/addons) contains `hr`, `hr_holidays` and `hr_work_entry`, and no payroll module. Payroll localizations are listed in the [Payroll docs](https://www.odoo.com/documentation/19.0/applications/hr/payroll.html). The edition-comparison icons on [odoo.com/page/editions](https://www.odoo.com/page/editions) could not be read as text, so "Enterprise-only" rests on the module being absent from the Community source. Self-hosting Enterprise requires the Custom plan ("Download Odoo Enterprise and host it yourself"). The [pricing page](https://www.odoo.com/pricing) served Indonesian-rupiah prices to this request: Custom Rp 255,000 per user per month (promotional), and Community has no listed price. The webhook action is `_run_action_webhook` in [ir_actions.py](https://github.com/odoo/odoo/blob/19.0/odoo/addons/base/models/ir_actions.py) (plain JSON POST, `timeout=1`, no signature header). See also [automation rules](https://www.odoo.com/documentation/19.0/applications/studio/automated_actions.html), [multi-company](https://www.odoo.com/documentation/19.0/applications/general/companies/multi_company.html) and [JSON-2 API](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html).
- **OrangeHRM.** [Repo](https://github.com/orangehrm/orangehrm) and [pricing](https://www.orangehrm.com/en/pricing): "Completely FREE & Open-source" Starter, with Advanced at an unpublished per-employee price.
- **Horilla.** [Repo](https://github.com/horilla-opensource/horilla). API authentication is from `horilla_api/README_API_DOCS.md` in the repo. The Postgres image is from `docker-compose.yml`.
- **IceHrm.** [Repo](https://github.com/gamonoid/icehrm). The [LICENSE](https://github.com/gamonoid/icehrm/blob/master/LICENSE) is Elastic License 2.0.

**Real cost of self-hosting.** Licence fees are zero, except Odoo, where payroll means paying for Enterprise. Tagaroa would run a Python or PHP application with its database, Redis and backups, and would absorb major-version upgrades. Frappe HR releases frequently (v16.52.0 in October 2026). Most importantly, statutory payroll rules per country (tax tables, social contributions, filings) are maintained in-repo only for India and the UAE in Frappe HR. They are not in Odoo Community at all, and none are documented for Horilla or OrangeHRM. Either Tagaroa maintains those rules or a local payroll bureau or EOR runs payroll in each country, with the HR system exporting inputs to them.

## 6. Recommendation

**Top pick: Deel.** For a group whose subsidiaries are its own legal entities in several countries, the deciding factors are:

- own-entity payroll and EOR on one worker record;
- a published core-HR price;
- signed webhooks for create, update, delete and termination;
- a SCIM-shaped read API that returns employment status, start and end dates, manager and legal entity for every person, which makes the monthly reconciliation scriptable.

Confirm three things in a sandbox before signing:

- that the countries where Tagaroa's entities operate are in Deel's own-entity payroll list;
- what `completion_date` on `contract.terminated` means;
- where personal email lives in the People API.

**Runner-up: Remote.** It is the better choice if price transparency for own-entity payroll matters most ($29 per employee per month is published) or if the in-house payroll model is preferred. Its webhook signature includes a timestamp, which is safer than Deel's. Confirm its core-HR depth (org chart, reporting lines) and its offboarding event timing first.

Conditions that change the choice:

- **Entities mostly in the UK and US, HR depth over payroll breadth:** HiBob. It has the best effective-date lifecycle webhooks (`employee.joined` / `employee.left`), but payroll elsewhere goes through Payroll Hub providers.
- **Entities mostly in Europe:** Personio is worth a sales call. Its effective-date webhooks match Tagaroa's needs, but none of its payroll coverage or pricing could be confirmed here.
- **Tagaroa wants zero custom webhook code:** Rippling is the only vendor confirmed to push SCIM to a custom app. Choose it only after sales confirms own-entity payroll in Tagaroa's countries and which plan includes custom SCIM apps.
- **EOR-heavy (few or no own entities):** Deel or Remote still win on integration. Oyster is EOR-only in practice and has no hire webhook found.
- **Workday and BambooHR:** do not fit. Workday is enterprise-scale with no public price and no webhooks. BambooHR runs US-only payroll and recommends one account per company.

**Can open source be the answer?** Only partly. The sources support this shape: an open-source core-HR system, with **Frappe HR** first because it has signed webhooks, a REST API, ERPNext multi-company and active releases, plus payroll outsourced per country to local bureaus or an EOR. They do not support open source as the whole answer for a multi-country group. Payroll localizations are maintained for very few countries (India and the UAE in Frappe HR), Odoo Community has no payroll, and IceHrm is not open source. That shape also gives up the main benefit of a commercial suite: payroll and employment status in one record. Tagaroa would own hosting, upgrades and the hand-off to every bureau. It makes sense only if licence cost dominates and the group has few countries with simple payroll.

## 7. Tagaroa-side connector for Deel (design sketch)

**Mechanism.** Use a webhook endpoint in `servers/core` (for example `POST /api/integrations/deel/webhooks`) plus a scheduled reconciliation poll. Do not use `@better-auth/scim`, for two reasons:

- Deel does not push SCIM.
- SCIM creation would bypass the issuance path (temporary password, `mustChangePassword`, onboarding email to `personalEmail`).

The package is present in `node_modules` (1.7.2) but is not a declared dependency of `servers/core`. It would also need its `projection.reconcileUser` hook to re-enter the issuance flow.

**Receiving events.**

1. Read the raw body. `AuthModule` already keeps raw JSON bytes (`rawBody: true`) for the notification webhooks.
2. Compute `HMAC-SHA256(key, "POST" + rawBody)` and compare it with `x-deel-signature` in constant time. Select the key by `x-deel-hmac-label`, so keys can be rotated.
3. Reject an already-seen `meta.event_id`, since the signature has no timestamp. Store processed IDs.
4. Return 2xx quickly and process asynchronously. Deel times out at 30 s and disables the subscription after 10 failures.
5. Treat the payload as a hint and re-read the worker from the Deel API, which has a 5 req/s organization-wide budget.

**Event mapping.**

| Deel signal                                                                       | Tagaroa action                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker V2 Created / Employee Created (direct or EOR), worker has a start date     | Open an issuance case. On or shortly before the start date, call admin issuance with the work email, `personalEmail` from Deel and the subsidiary resolved from the Deel legal entity. The temporary password, onboarding email and audit entry happen as today. Missing personal email stops the case for a human.       |
| Worker V2 Updated where legal entity, department or org structure changed         | Recompute subsidiary and team membership from a mapping table (Deel legal entity → Tagaroa subsidiary, Deel department/team → Tagaroa team). Apply the change at its effective date. Changes that touch privileged roles or subsidiary-wide grants queue for an identity administrator instead of applying automatically. |
| Contract Terminated (`completion_date`), or SCIM `endDate` set and `active` false | Schedule "Offboard employee" at the effective cutoff, end of `endDate` in the entity's time zone, unless the termination is marked immediate. The reason is the Deel contract reference.                                                                                                                                  |
| Worker V2 Deleted                                                                 | Do not delete. Flag for review, since deletion in Deel is not a termination instruction.                                                                                                                                                                                                                                  |

**Automated monthly reconciliation.** Replace the manual roster check in access-operations.md with a job that pages Deel's SCIM `/Users`:

1. Join Deel users to Tagaroa accounts by a stored Deel worker ID, falling back to work email.
2. Emit a diff:
   - active in Tagaroa but inactive, ended or absent in Deel;
   - active in Deel with no Tagaroa account past the start date;
   - subsidiary or team in Tagaroa that differs from the mapped Deel entity or department;
   - privileged roles held by anyone Deel shows as ended.
3. Write the diff to the case register as open items. Departed accounts may be suspended automatically. Everything else waits for an operator.

The weekly privileged review stays as written.

**What stays manual.**

- Manager approval for exceptions.
- Privileged role grants and break-glass access.
- Factor and password recovery.
- Correcting mapping-table gaps (new entity or team).
- Starters with no personal email.
- Contractors, unless policy says otherwise.
- The independent checker for privileged changes.

The people-operations lead becomes the owner of data quality in Deel rather than of a separate roster.

## 8. Sources (all accessed 2026-10-26)

Context in this repo: `docs/security/access-operations.md`, `docs/adr/0001-admin-managed-accounts.md`.

Deel

- https://www.deel.com/pricing/
- https://www.deel.com/hr/
- https://www.deel.com/global-payroll/
- https://developer.deel.com/api/webhooks/introduction
- https://developer.deel.com/api/webhooks/events
- https://developer.deel.com/api/stable/hris-endpoints/hris/webhook-worker-v-2-updated.md
- https://developer.deel.com/api/stable/hris-endpoints/hris/webhook-worker-v-2-deleted.md
- https://developer.deel.com/api/stable/endpoints/terminations/webhook-contract-terminated.md
- https://developer.deel.com/api/scim-api/overview
- https://developer.deel.com/api/hris-common-use-cases/sync-deel-users-to-identity-providers
- https://developer.deel.com/api/hris
- https://developer.deel.com/api/stable/rate-limits.md
- https://developer.deel.com/api/stable/llms.txt

Remote

- https://remote.com/pricing
- https://remote.com/global-hr/global-payroll
- https://support.remote.com/hc/en-us/articles/31914612274189-Creating-and-managing-multiple-entities-in-one-company-account
- https://developer.remote.com/docs/subscribing-to-webhooks
- https://developer.remote.com/docs/verifying-webhooks
- https://developer.remote.com/docs/sync-workforce-data
- https://developer.remote.com/reference/employmentonboardingcompleted
- https://developer.remote.com/reference/offboardingcompleted

Rippling

- https://www.rippling.com/pricing
- https://www.rippling.com/en-AU/rippling-platform-tiers
- https://www.rippling.com/global-payroll-and-hiring
- https://www.rippling.com/products/it/identity-access-management
- https://developer.rippling.com/llms.txt

HiBob

- https://www.hibob.com/pricing/
- https://www.hibob.com/features/payroll/
- https://apidocs.hibob.com/reference/getting-started-webhooks
- https://apidocs.hibob.com/reference/employee-data-webhooks
- https://apidocs.hibob.com/docs/rate-limit

Personio

- https://developer.personio.de/reference/webhooks
- https://developer.personio.de/docs/event-driven-data-from-personio
- https://developer.personio.de/changelog/webhooks-effective-date-notification-webhooks-employmentstarted-and-employmentterminated
- https://developer.personio.de/reference/listlegalentities
- https://developer.personio.de/reference/authentication
- https://www.personio.com/pricing/ (not readable: HTTP 429)

Workday

- https://www.workday.com/en-us/products/payroll/global-payroll.html
- https://developer.workday.com/doc/GUID-0c99dd81-6964-4adf-90d7-f27402c5fc9a.md
- https://developer.workday.com/doc/jas1395101817299.md

BambooHR

- https://www.bamboohr.com/pricing/
- https://documentation.bamboohr.com/docs/getting-started
- https://documentation.bamboohr.com/docs/webhooks
- https://documentation.bamboohr.com/docs/event-based-webhooks
- https://bamboohr.screenstepslive.com/m/84572/l/1638061-managing-multiple-companies-with-payroll-faq

Oyster

- https://www.oysterhr.com/pricing
- https://www.oysterhr.com/global-payroll
- https://docs.oysterhr.com/docs/getting-started-with-webhooks
- https://docs.oysterhr.com/changelog/oyster-api-updates-26-may-2025

Others

- https://apidoc.factorialhr.com/docs/webhook-employee-terminated
- https://docs.papayaglobal.com/api-reference/webhooks-notifications

Open source

- https://github.com/frappe/hrms
- https://github.com/frappe/hrms/blob/develop/hrms/hooks.py
- https://github.com/frappe/hrms/tree/develop/hrms/regional
- https://docs.frappe.io/erpnext/company-setup
- https://docs.frappe.io/framework/user/en/guides/integration/webhooks
- https://docs.frappe.io/framework/user/en/api/rest
- https://docs.frappe.io/framework/user/en/installation
- https://github.com/odoo/odoo/blob/19.0/LICENSE
- https://github.com/odoo/odoo/tree/19.0/addons
- https://github.com/odoo/odoo/blob/19.0/odoo/addons/base/models/ir_actions.py
- https://www.odoo.com/documentation/19.0/applications/hr/payroll.html
- https://www.odoo.com/documentation/19.0/applications/studio/automated_actions.html
- https://www.odoo.com/documentation/19.0/applications/general/companies/multi_company.html
- https://www.odoo.com/documentation/19.0/developer/reference/external_api.html
- https://www.odoo.com/page/editions
- https://www.odoo.com/pricing
- https://github.com/orangehrm/orangehrm
- https://www.orangehrm.com/en/pricing
- https://github.com/horilla-opensource/horilla
- https://github.com/gamonoid/icehrm
- https://github.com/gamonoid/icehrm/blob/master/LICENSE
