import { Inject, Injectable, Logger } from "@nestjs/common";
import { asObject } from "@repo/contracts";
import { AfterHook, Hook } from "@thallesp/nestjs-better-auth";
import { eq } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../platform/database/database.module";
import {
  NOTIFICATION_SENDER,
  type NotificationSender,
} from "../notification/application/notification.facade";
import { user } from "./infrastructure/persistence/drizzle/schema";

/** The part of Better Auth's middleware context these hooks read. */
interface AuthHookContext {
  body?: unknown;
  context: { returned?: unknown };
}

export interface OnboardingSend {
  to: string;
  variables: Record<string, string>;
}

/**
 * What became of the one message this account depended on.
 *
 * It rides back on the response because the admin who just issued the account
 * is the only person who can rescue it: they still hold the password on screen,
 * and if nothing was queued they must pass it on themselves. Telling them
 * "queued" regardless would be promising something the service did not do.
 */
export interface OnboardingOutcome {
  queued: boolean;
  destination: string | null;
  reason?: string;
}

/** Someone who has never signed in has no display name worth using. */
const addressed = (name: unknown, email: string): string =>
  typeof name === "string" && name.trim().length > 0 ? name.trim() : email;

/**
 * The address and the temporary password an admin just issued.
 *
 * It goes to the personal address the admin supplied, never to the workspace
 * address the account was created with: staff mail lives inside the workspace,
 * so a message sent there could only be read by someone who can already sign
 * in. That is the loop this one message exists to break. The workspace address
 * still travels *in* the message, because it is what they sign in with.
 *
 * See `docs/adr/0001-admin-managed-accounts.md`.
 */
export const issuedNotification = (
  body: unknown,
  returned: unknown,
): OnboardingSend | undefined => {
  const created = asObject(asObject(returned)?.user);
  const request = asObject(body);
  const password = request?.password;
  const personalEmail = asObject(request?.data)?.personalEmail;
  if (
    typeof created?.email !== "string" ||
    typeof password !== "string" ||
    typeof personalEmail !== "string"
  ) {
    return undefined;
  }

  return {
    to: personalEmail,
    variables: {
      email: created.email,
      name: addressed(created.name, created.email),
      password,
    },
  };
};

/**
 * The same, for a password an admin reissued. The route carries a user id
 * rather than an address, so the account is looked up before the message can be
 * addressed — and it is addressed to the personal address for the same reason
 * onboarding is. An account issued before that address was recorded has none,
 * and there is nowhere to write: the admin delivers it by hand instead.
 */
export const resetNotification = (
  body: unknown,
  account:
    | { email: string; name: string | null; personalEmail: string | null }
    | undefined,
): OnboardingSend | undefined => {
  const password = asObject(body)?.newPassword;
  if (!account?.personalEmail || typeof password !== "string") return undefined;

  return {
    to: account.personalEmail,
    variables: {
      email: account.email,
      name: addressed(account.name, account.email),
      password,
    },
  };
};

/**
 * The one message the workspace sends to a person: the account they have been
 * given, and the temporary password to open it with.
 *
 * It runs after Better Auth has answered, so the account already exists by the
 * time anything is enqueued. A failure here is therefore logged rather than
 * thrown: wording that has not been published yet is a reason to chase the
 * message, never a reason to tell an admin that the account they just created
 * failed. The message row is the record of what happened either way.
 */
@Hook()
@Injectable()
export class OnboardingHook {
  private readonly logger = new Logger(OnboardingHook.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(NOTIFICATION_SENDER)
    private readonly notifications: NotificationSender,
  ) {}

  @AfterHook("/admin/create-user")
  async accountIssued(context: AuthHookContext): Promise<void> {
    const returned = asObject(context.context.returned);
    const send = issuedNotification(context.body, context.context.returned);
    if (!send) {
      this.report(returned, {
        destination: null,
        queued: false,
        reason: "No personal address was given",
      });
      return;
    }

    const created = asObject(returned?.user);
    const outcome = await this.enqueue("account.issued", send, {
      // One account, one welcome, however many times the request is retried.
      idempotencyKey:
        typeof created?.id === "string"
          ? `account.issued:${created.id}`
          : undefined,
    });
    this.report(returned, outcome);
  }

  @AfterHook("/admin/set-user-password")
  async passwordReset(context: AuthHookContext): Promise<void> {
    // After hooks run for refusals too; only a password that was set is sent.
    const returned = asObject(context.context.returned);
    if (returned?.status !== true) return;
    const userId = asObject(context.body)?.userId;
    if (typeof userId !== "string") return;

    const [account] = await this.database
      .select({
        email: user.email,
        name: user.name,
        personalEmail: user.personalEmail,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    // No idempotency key: a password may be reissued as often as someone
    // locks themselves out, and each one is a message they need.
    const send = resetNotification(context.body, account);
    if (!send) {
      this.report(returned, {
        destination: null,
        queued: false,
        reason: "No personal address is on file",
      });
      return;
    }

    this.report(
      returned,
      await this.enqueue("account.password-reset", send, {}),
    );
  }

  async deliverRecoveryPassword(
    account: {
      email: string;
      name: string | null;
      personalEmail: string | null;
    },
    password: string,
    recoveryId: string,
  ): Promise<OnboardingOutcome> {
    const send = resetNotification({ newPassword: password }, account);
    return send
      ? this.enqueue("account.password-reset", send, {
          idempotencyKey: `factor-recovery:${recoveryId}`,
        })
      : {
          destination: null,
          queued: false,
          reason: "No personal address is on file",
        };
  }

  /**
   * Better Auth serialises whatever object the endpoint returned, so an extra
   * field on it reaches the caller — the same route
   * `applyTemporaryPasswordLifecycle` takes to report `mustChangePassword`.
   */
  private report(
    returned: Record<string, unknown> | undefined,
    outcome: OnboardingOutcome,
  ): void {
    if (returned) returned.onboarding = outcome;
  }

  private async enqueue(
    key: string,
    send: OnboardingSend,
    options: { idempotencyKey?: string },
  ): Promise<OnboardingOutcome> {
    try {
      const message = await this.notifications.send({
        channel: "email",
        key,
        to: send.to,
        variables: send.variables,
        ...options,
      });

      // A suppressed destination still gets a row, but nothing will ever leave
      // for it. That is a message the admin has to deliver themselves.
      return message.status === "suppressed"
        ? {
            destination: send.to,
            queued: false,
            reason: "That address is suppressed",
          }
        : { destination: send.to, queued: true };
    } catch {
      // Queue errors may echo the payload, including its temporary password.
      const reason = "The notification could not be queued";
      this.logger.error(`Could not enqueue ${key} for ${send.to}`);
      return { destination: send.to, queued: false, reason };
    }
  }
}
