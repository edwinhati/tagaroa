# Identity and access operations

Effective 22 October 2026. There is currently no HR system. The admin directory and authorized lifecycle workflows are the source of truth for employment access changes. These procedures require people to perform and record the checks; the application does not verify employment or ticket evidence automatically.

## Ownership

| Responsibility                                                                                   | Accountable role                                                                             |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Verify employment, transfer and termination instructions                                         | Employee's manager and a company owner or designated people-operations lead                  |
| Verify routine recovery identity, request factor recovery and issue employee temporary passwords | Helpdesk                                                                                     |
| Create accounts and change subsidiary/team membership                                            | Identity administrator                                                                       |
| Recover privileged accounts and grant privileged access                                          | Super administrator                                                                          |
| Confirm weekly privileged identity access                                                        | Access reviewer, identity administrator or super administrator other than the account holder |
| Review business assignments and emergency activity                                               | Access reviewer with the relevant subsidiary or team manager                                 |

Assign named primary and backup operators before production rollout. Maintain at least two independently controlled super-admin accounts. An operator cannot confirm their own privileged access. A sole operator needs a second authorized reviewer; bypassing the check is not a recovery procedure. Helpdesk may request factor recovery for a privileged account, but only a separate super-admin can approve it. The account holder can neither request nor approve their own recovery.

## Working without an HR system

The company owner appoints a people-operations lead and backup to receive manager instructions about joins, transfers and departures. This is an operational responsibility, not an application permission or an assumption that an HR department exists. Managers notify them before a planned departure cutoff and immediately for an unexpected departure. An authorized administrator performs the access change at the cutoff and records completion.

Keep a restricted staff roster and case register in an existing company-controlled document or ticket system. Use the application account ID to link records until an employee numbering scheme exists. Record the manager, employment status, start/change/end time, approved subsidiary and teams, requested access, approver, operator and completion evidence. Do not put credentials or identity documents in this register. The roster records employment instructions; the app directory records actual access.

Before launch, reconcile every active account with the manager-confirmed roster. Suspend departed or unverified accounts through an authorized operator, review privileged roles and subsidiary-wide grants, and record discrepancies through resolution. Repeat this reconciliation monthly, including ordinary employees. Continue the weekly privileged review below. These are manual procedures; the app does not send review reminders. When Frappe HR is configured, the core service issues an ordinary account for an active employee and offboards a leaver on their relieving date ([ADR 0004](../adr/0004-hr-record-drives-joiners-and-leavers.md)); the reconciliation still covers people outside HR, transfers, and everything HR does not decide.

Record named primary and backup owners for people operations, identity administration, recovery verification and access review in the restricted register. Record which two people control the super-admin accounts, and identify a separate recovery requester. Keep verification, approval and self-review restrictions even when one person holds several operational responsibilities.

### Record for each access change

Copy this into the restricted case register for each join, transfer or departure.

- Case reference and application account ID:
- Employee and accountable manager:
- Change requested and effective time, including time zone:
- Manager approval and verification reference:
- Approved subsidiary, teams and access, including expiry:
- Access to remove and sessions to revoke:
- Assigned operator and backup:
- Completion time and verification result:
- Independent checker for privileged changes:
- Unresolved issues, owner and next action:

The manager confirms the employment instruction; an authorized operator confirms the resulting application access. Leave a case open until discrepancies are resolved.

## Recovery

1. Open a recovery case with a reference, employee id, affected account, requested action, operator and time. Store identity evidence in the restricted case system, never in audit text or notification payloads.
2. Verify the person through an established channel already held by the company, such as a callback to an existing directory number plus confirmation from their manager. A message from the requester, knowledge of their email, and a new phone number supplied in the same request are insufficient. If verification fails, stop and escalate.
3. Helpdesk may recover employees only. A different super-admin verifies and handles recovery of privileged accounts. Changes to the delivery address require separate verification; do not redirect a password to an address supplied by an unverified requester.
4. Sign in again before issuing a replacement password. The server requires a session less than 15 minutes old for password reset, impersonation and account deletion. An impersonated session can read and stop impersonating, but every grant, role change, break-glass, review and admin or subsidiary write refuses it, so those always run from the operator's own MFA-protected account. Issuing a temporary password revokes the target's sessions; verify the result and delivery outcome.
5. Deliver through the existing account flow to the personal address on file, or use a separately verified handover when no address exists. The temporary password expires after 24 hours and must be replaced before business access. Never paste passwords, recovery codes or session tokens into the case or audit trail.
6. A routine password reset keeps existing factors. If all factors are lost, open the person's detail page and choose **Request factor recovery**. Record the reason, a restricted case reference and verification evidence, and attest that identity was checked through established company channels. Do not store passwords, codes or identity documents in these notes.
7. A different super-admin opens **Reviews → Factor recovery**, verifies identity independently, records separate evidence, and approves. Both operators must use their own MFA-protected accounts and sign in within 15 minutes. Requests expire after one hour. Account changes invalidate the request and require a new verification. A suspended account must go through the separate restoration process first.
8. Approval rotates the password, deletes old passkeys/authenticator and recovery-code records, removes trusted-device and pending 2FA verification records, and revokes sessions in one transaction. It issues a 24-hour temporary password through the existing delivery flow. The password is shown once to the approver for verified handover if delivery fails. It is never stored in the recovery record or audit text. Closing a response or retrying approval does not issue another credential.
9. The employee replaces the password, checks sessions and enrolls new factors. Privileged access remains unavailable until MFA is enrolled again. The operator records completion, delivery failure or escalation against the case reference.

Suspected compromise requires immediate suspension and session revocation before investigation. Preserve audit records and review changes made since the suspected compromise. Verify restoration separately before re-enabling the account.

## Join, transfer and leave

### Join

1. Receive recorded manager authorization and verify the employee's personal delivery address.
2. Issue an employee account through the existing account flow, or confirm the Frappe HR sync issued it. Add only the approved subsidiary and teams. Titles and reporting lines do not grant permissions.
3. Require password replacement, encourage passkey enrollment, and require MFA enrollment before privileged grants.
4. Grant the narrowest business role at team scope. Use subsidiary scope only when the person is responsible for every child team. Use an expiry for temporary responsibilities.
5. Record the business justification, manager and any expiry in the restricted case. Confirm the employee can enter the intended domains and cannot enter an unassigned domain.

### Transfer

1. Compare the employee's current memberships, business assignments and identity roles with the new responsibilities.
2. Remove obsolete memberships. Team departure atomically revokes team-scoped business grants and ends matching emergency access; subsidiary departure does the same across that subsidiary. Then add approved memberships and new grants. A subsidiary-wide assignment remains valid across its child teams until subsidiary membership is removed or the assignment is revoked; review it explicitly during a team transfer. Do not copy the old role set by default.
3. Revoke sessions when the change is security-sensitive and verify effective access after the transfer.
4. Remove obsolete titles/reporting lines and obtain manager confirmation. Removed grants stay revoked when membership is restored; a new grant is required.

### Leave

1. At the authorized cutoff, open the person's detail page and choose **Offboard employee**. Record the manager authorization/case reference. Another identity administrator handles employees; another super-admin handles privileged accounts. Recent sign-in and MFA are required.
2. The operation atomically suspends the account, revokes sessions and business grants, removes subsidiary/team memberships, clears identity privileges, and ends emergency access. It is safe to retry. Verify the person cannot sign in or use a previous session. Ordinary suspension also revokes business grants; restoration requires new grants.
3. Preserve the account and audit evidence during the retention period. Account deletion requires a separate retention decision and recent sign-in; it is not the default offboarding action.
4. Record the completion time and operator. A second operator verifies the result for privileged accounts.
5. With Frappe HR configured, setting the employee to `Left` with a relieving date performs steps 1–2 on that date through the same operation, audited with no actor and the HR record as its source. It never offboards a privileged account; a super-admin does that by hand. Still record the case, verify the result, and offboard by hand anyone whose departure HR does not record.

## Weekly access review

The application's identity review week starts Monday at 00:00 UTC. A changed identity row invalidates its previous confirmation. Historical self-confirmations and confirmations whose reviewer was deleted no longer count.

1. An independent reviewer opens Identity & access → Reviews. Confirm employment, current duties and the necessity of each identity role with the accountable manager before confirming access. Remove unnecessary roles through an authorized operator.
2. Open **Reviews → Business assignments** and inspect active grants, especially subsidiary-wide grants and grants without expiry. Confirm the role, person, subsidiary/team, manager and duration. A reviewer other than both the holder and grantor records **Confirm access** or **Flag for action**, with a case/evidence note. Changed grants or roles invalidate the displayed version, and confirmation is due again each week.
3. Open **Reviews → Emergency access** after the activation ends or expires. Inspect activity for its activation and use, match the reason and scope to its case, and record an independent decision. Emergency history survives sign-out. Also inspect impersonation, privileged grants and password resets. Emergency access is limited to one permission/scope, one session and 15 minutes; a reason alone is not independent approval.
4. Decisions, notes, reviewers, times and reviewed versions are persisted. Earlier business and emergency decisions remain as separate records, with audit events for each review. Keep the restricted case as supporting evidence. Flagging is an escalation, not automatic revocation; an administrator must investigate and revoke inappropriate grants. Review reminders are not automated.
5. Escalate incomplete reviews to the security owner. A confirmation is evidence of review, not proof of authorization correctness, and an overdue review does not automatically revoke access.

## Authentication assurance

Privileged policy checks MFA enrollment. Recent authentication means session creation within 15 minutes; it is not evidence that a fresh TOTP challenge occurred for the action. Trusted devices may skip a TOTP prompt for 30 days. Passkeys require user verification. Use the authentication audit trail when investigating how a session was established.

## Remaining work and acceptance

- Keep provisioning admin-managed while no HR system exists. If an HR system is introduced, validate its authenticated integration contract before automating provisioning. Require an immutable employee id, effective times, idempotent changes and reconciliation before granting production access.
- Add permissions for actual domain actions as those workflows are built. Do not invent approval, export or financial permissions without a resource and server-side operation to protect.
- Test backup administrator recovery and monitor audit events before production. Human ownership and independent review cannot be established by deploying code alone.

## Domain admission

**Subsidiaries** links each team id to a known domain slug through an explicit domain selector. The initial migration preserves recognized legacy names, including multi-word names, once. New teams have no domain until an identity administrator links one. Renaming a team does not change its link. Current membership in both the team and subsidiary is required; identity roles do not bypass this rule.

## Release and recovery exercises

See [access-control rollout](access-control-rollout.md) for migration order, preservation checks and rollback. The automated HTTP and browser exercises cover independent factor recovery, account drift, concurrent approval, temporary credential replacement and offboarding. They use fixture accounts in a test database. Repeat the documented cases with designated operators and verified delivery channels in staging before production use.
