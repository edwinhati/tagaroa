# Connecting Frappe HR

How to point `servers/core` at a Frappe HR (v16) site so that joiners are issued accounts
and leavers are offboarded. What the sync does and does not decide is in
[ADR 0004](../adr/0004-hr-record-drives-joiners-and-leavers.md); the people-side procedure
is in [access operations](access-operations.md).

## 1. A read-only API user in Frappe

1. **Role.** Create a role, e.g. `Tagaroa Sync`, with **Desk Access** off.
2. **Permission.** In **Role Permissions Manager**, give that role **Read** on **Employee**
   and nothing else — no Write, Create, Delete, Export or Report.
3. **User.** Create a user, e.g. `tagaroa-sync@company.example`, with only that role.
4. **Keys.** On the user, **Settings → API Access → Generate Keys**. Copy the API key and
   secret now; Frappe shows the secret once.

The core service reads `name`, `employee_name`, `status`, `company_email`,
`personal_email` and `relieving_date`, and nothing else. If Employee records are limited by
**User Permissions** (per company, for instance), the sync sees only what the API user may
see — give it every company the group runs.

## 2. The webhook

**Integrations → Webhook → New:**

| Field             | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| DocType           | `Employee`                                                   |
| Doc Event         | `on_change` — runs after every save, including the first     |
| Request URL       | `<BETTER_AUTH_URL>/api/hr/webhooks/frappe`                   |
| Request Method    | `POST`                                                       |
| Request Structure | `JSON`                                                       |
| JSON Request Body | `{"name": "{{ doc.name }}"}`                                 |
| Enable Security   | ticked                                                       |
| Webhook Secret    | 32 or more random characters, e.g. `openssl rand -base64 32` |

Send nothing else in the body. The core service re-reads the record through the API, so
personal data never travels in the webhook and a replayed request can only cause a re-read.
Without **Enable Security** every request is refused with `401`.

## 3. The core service

In `servers/core/.env` (all four, or none):

```sh
FRAPPE_URL=https://hr.company.example
FRAPPE_API_KEY=...
FRAPPE_API_SECRET=...
FRAPPE_WEBHOOK_SECRET=...   # the same value as the webhook's secret
```

Startup refuses a secret under 32 characters, and in production a `FRAPPE_URL` that is not
HTTPS. Email delivery (`RESEND_*` and the notification worker) must be live: an account
issued from HR has a temporary password nobody else ever sees, so an onboarding email that
is not sent leaves an administrator to reissue it.

On start the service reconciles every employee once, then hourly.

## 4. Before relying on it

1. **Fill in the records.** Every active employee needs a **Company Email** (the workspace
   address they sign in with) and a **Personal Email** (where the temporary password
   goes). Records missing either, or giving the company email as the personal one, are skipped and logged.
2. **Existing accounts are adopted.** An account whose address matches an employee's company
   email is linked to that employee on first sight rather than issued again. Check the
   roster for mismatched addresses first, or the sync will issue a second account to the
   new address.
3. **Restrict who can activate employees.** Whoever can set an Employee to `Active` with a
   company email causes an account to be issued. Limit Employee write access in Frappe to
   people operations.
4. **Try one record.** Create a test employee with your own personal address, check the
   onboarding email arrives and the account appears in `apps/admin`, then set it to `Left`
   with today's relieving date and wait for the next pass (or restart the service) to see it
   offboarded.

## Troubleshooting

- **Frappe shows the request failed.** Open **Webhook Request Log** in Frappe. `401` means
  the secret differs or security is off; `400` means the body does not carry `name`.
- **Nothing happened, no error.** The record did not call for anything: not `Active`,
  already has an account, or a relieving date still in the future. The core service logs a
  line when a record is skipped for a missing address, a suspended account, an address
  linked to another record, a privileged account, or a future relieving date; a record that is simply not
  `Active` is skipped silently.
- **"Its company email belongs to another record's account".** Two Employee records share a
  company email. Fix the record in Frappe; the sync will not guess.
- **"Its account is privileged; a super-admin offboards it by hand".** The company email
  belongs to an administrator. The sync never adopts or retires a privileged account, even
  for a `Left` record: a super-admin offboards it in `apps/admin`, or removes the role first
  if the account should follow HR from then on.
- **"Active in HR but suspended here".** The account was suspended in Tagaroa. Restoring it
  is an administrator's decision in `apps/admin`, never automatic.
- **A webhook was missed.** The hourly pass catches it. Relieving dates are compared by UTC
  day.
