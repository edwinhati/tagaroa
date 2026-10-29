import { randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { asObject } from "@repo/contracts";
import { AuthService } from "@thallesp/nestjs-better-auth";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../audit/application/audit.facade";
import type { Auth } from "./auth";
import { IdentityOperationsService } from "./identity-operations.service";

export const ACCOUNT_LIFECYCLE = Symbol("ACCOUNT_LIFECYCLE");

export interface AccountState {
  id: string;
  banned: boolean;
}

/**
 * Accounts as another module may drive them, on nobody's behalf: something the
 * service does because a system of record said so, not because an operator
 * clicked. Every act is audited with no actor and with the stated source.
 */
export interface AccountLifecycle {
  byId(id: string): Promise<AccountState | null>;
  byEmail(email: string): Promise<AccountState | null>;
  /**
   * Issue through the same Better Auth route an administrator uses, so the
   * temporary password, the forced change and the onboarding email to the
   * personal address all follow. Nobody ever sees the password: if onboarding
   * was not queued, an admin has to reissue one.
   */
  issue(input: {
    email: string;
    name: string;
    personalEmail: string;
    source: string;
  }): Promise<{ id: string; onboardingQueued: boolean }>;
  /** Suspend, drop sessions and memberships. The last super-admin is kept. */
  retire(id: string, detail: string): Promise<void>;
}

@Injectable()
export class AccountLifecycleFacade implements AccountLifecycle {
  constructor(
    private readonly auth: AuthService<Auth>,
    private readonly identity: IdentityOperationsService,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  async byId(id: string): Promise<AccountState | null> {
    const context = await this.auth.instance.$context;
    return state(await context.internalAdapter.findUserById(id));
  }

  async byEmail(email: string): Promise<AccountState | null> {
    const context = await this.auth.instance.$context;
    return state((await context.internalAdapter.findUserByEmail(email))?.user);
  }

  async issue(input: {
    email: string;
    name: string;
    personalEmail: string;
    source: string;
  }): Promise<{ id: string; onboardingQueued: boolean }> {
    // No headers: Better Auth treats this as the service acting, and the
    // admin-policy middleware only checks a session when there is one.
    const returned = asObject(
      await this.auth.api.createUser({
        body: {
          data: { personalEmail: input.personalEmail },
          email: input.email,
          name: input.name,
          password: randomBytes(16).toString("base64url"),
          role: "user",
        },
      }),
    );
    const id = asObject(returned?.user)?.id;
    if (typeof id !== "string") throw new Error("Better Auth issued no user");
    await this.audit.record({
      actorId: null,
      detail: `${input.email} from ${input.source}`,
      targetUserId: id,
      type: "user.created",
    });
    return {
      id,
      onboardingQueued: asObject(returned?.onboarding)?.queued === true,
    };
  }

  retire(id: string, detail: string): Promise<void> {
    return this.identity.retire(id, detail, null);
  }
}

const state = (user: unknown): AccountState | null => {
  const row = asObject(user);
  return typeof row?.id === "string"
    ? { banned: row.banned === true, id: row.id }
    : null;
};
