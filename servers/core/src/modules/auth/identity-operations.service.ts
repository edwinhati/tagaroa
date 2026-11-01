import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword } from "better-auth/crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../platform/database/database.module";
import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../audit/application/audit.facade";
import {
  canManageTarget,
  isSuperAdmin,
  OWN_OPERATOR_ACCOUNT_REQUIRED,
  requireOwnSession,
  rolesOf,
} from "./access-policy";
import { TEMPORARY_PASSWORD_LIFETIME_MS } from "./auth";
import type {
  ApproveRecoveryBody,
  RequestRecoveryBody,
} from "./auth-management.schemas";
import {
  account,
  member,
  passkey,
  session,
  teamMember,
  twoFactor,
  user,
  verification,
} from "./infrastructure/persistence/drizzle/schema";
import { OnboardingHook } from "./onboarding.hook";
import { factorRecovery } from "./operations.schema";

export interface IdentityOperator {
  id: string;
  role: string | null | undefined;
  twoFactorEnabled: boolean;
  sessionCreatedAt: Date;
  impersonatedBy?: string | null;
}

export const requireVerifiedOperator = (actor: IdentityOperator): void => {
  const age = Date.now() - actor.sessionCreatedAt.getTime();
  requireOwnSession(actor);
  if (!actor.twoFactorEnabled)
    throw new ForbiddenException(OWN_OPERATOR_ACCOUNT_REQUIRED);
  if (!Number.isFinite(age) || age < 0 || age >= 15 * 60_000)
    throw new ForbiddenException({
      code: "SESSION_NOT_FRESH",
      message: "Sign in again before changing account security.",
    });
};
const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const recoverySnapshot = (
  target: typeof user.$inferSelect,
  credentials: (typeof account.$inferSelect)[],
  factors: (typeof twoFactor.$inferSelect)[],
  keys: (typeof passkey.$inferSelect)[],
): string =>
  digest({
    target,
    credentials: credentials
      .map(({ id, password }) => ({ id, password }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    factors: factors
      .map(({ id, secret, backupCodes, verified }) => ({
        id,
        secret,
        backupCodes,
        verified,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    keys: keys
      .map(({ id, credentialID, publicKey }) => ({
        id,
        credentialID,
        publicKey,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });

@Injectable()
export class IdentityOperationsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    private readonly onboarding: OnboardingHook,
  ) {}

  async listRecoveries() {
    const rows = await this.database
      .select({
        id: factorRecovery.id,
        userId: factorRecovery.userId,
        requestedBy: factorRecovery.requestedBy,
        requestedAt: factorRecovery.requestedAt,
        expiresAt: factorRecovery.expiresAt,
        reason: factorRecovery.reason,
        evidence: factorRecovery.evidence,
        completedAt: factorRecovery.completedAt,
        approvedBy: factorRecovery.approvedBy,
        approvalEvidence: factorRecovery.approvalEvidence,
      })
      .from(factorRecovery);
    const now = new Date();
    return rows.map((row) => ({ ...row, expired: row.expiresAt <= now }));
  }

  async requestRecovery(
    userId: string,
    { reason, evidence }: RequestRecoveryBody,
    actor: IdentityOperator,
  ) {
    requireVerifiedOperator(actor);
    if (
      !rolesOf(actor.role).some((role) =>
        ["helpdesk", "admin", "super-admin"].includes(role),
      )
    )
      throw new ForbiddenException();
    if (actor.id === userId)
      throw new ForbiddenException(
        "Another operator must request your recovery.",
      );
    const id = randomUUID();
    await this.database.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .for("update");
      if (!target) throw new NotFoundException("Person not found.");
      if (target.banned)
        throw new ConflictException(
          "Restore the account through the suspension process before factor recovery.",
        );
      const [credentials, factors, keys] = await Promise.all([
        tx
          .select()
          .from(account)
          .where(
            and(
              eq(account.userId, userId),
              eq(account.providerId, "credential"),
            ),
          ),
        tx.select().from(twoFactor).where(eq(twoFactor.userId, userId)),
        tx.select().from(passkey).where(eq(passkey.userId, userId)),
      ]);
      if (!credentials.length || (!target.twoFactorEnabled && !keys.length))
        throw new ConflictException(
          "Use ordinary password recovery for this account.",
        );
      const existing = await tx
        .select({ id: factorRecovery.id })
        .from(factorRecovery)
        .where(
          and(
            eq(factorRecovery.userId, userId),
            isNull(factorRecovery.completedAt),
            gt(factorRecovery.expiresAt, new Date()),
          ),
        );
      if (existing.length)
        throw new ConflictException(
          "An unexpired recovery request already exists.",
        );
      const snapshot = recoverySnapshot(target, credentials, factors, keys);
      await tx.insert(factorRecovery).values({
        id,
        userId,
        requestedBy: actor.id,
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60_000),
        reason,
        evidence,
        snapshot,
      });
    });
    await this.audit.record({
      actorId: actor.id,
      targetUserId: userId,
      type: "user.factor-recovery.requested",
      detail: `${id}: ${reason}; ${evidence}`,
    });
    return { id };
  }

  async approveRecovery(
    id: string,
    { evidence }: ApproveRecoveryBody,
    actor: IdentityOperator,
  ) {
    requireVerifiedOperator(actor);
    if (!isSuperAdmin(actor.role))
      throw new ForbiddenException(
        "A super administrator must approve recovery.",
      );
    const temporaryPassword = randomBytes(24).toString("base64url");
    const password = await hashPassword(temporaryPassword);
    const target = await this.database.transaction(async (tx) => {
      const [recovery] = await tx
        .select()
        .from(factorRecovery)
        .where(eq(factorRecovery.id, id))
        .for("update");
      if (!recovery) throw new NotFoundException("Recovery request not found.");
      if (
        !recovery.requestedBy ||
        recovery.requestedBy === actor.id ||
        recovery.userId === actor.id
      )
        throw new ForbiddenException(
          "A different super administrator must approve this request.",
        );
      const [requester] = await tx
        .select()
        .from(user)
        .where(eq(user.id, recovery.requestedBy));
      if (
        !requester ||
        requester.banned ||
        !requester.twoFactorEnabled ||
        !rolesOf(requester.role).some((role) =>
          ["helpdesk", "admin", "super-admin"].includes(role),
        )
      )
        throw new ConflictException(
          "The requester is no longer an authorized operator.",
        );
      if (recovery.completedAt || recovery.expiresAt <= new Date())
        throw new ConflictException("This request is completed or expired.");
      const [person] = await tx
        .select()
        .from(user)
        .where(eq(user.id, recovery.userId))
        .for("update");
      if (!person) throw new NotFoundException("Person not found.");
      const [credentials, factors, keys] = await Promise.all([
        tx
          .select()
          .from(account)
          .where(
            and(
              eq(account.userId, person.id),
              eq(account.providerId, "credential"),
            ),
          ),
        tx.select().from(twoFactor).where(eq(twoFactor.userId, person.id)),
        tx.select().from(passkey).where(eq(passkey.userId, person.id)),
      ]);
      const current = recoverySnapshot(person, credentials, factors, keys);
      if (current !== recovery.snapshot) {
        await tx
          .update(factorRecovery)
          .set({ expiresAt: new Date(0) })
          .where(eq(factorRecovery.id, id));
        return null;
      }
      const now = new Date();
      await tx
        .update(account)
        .set({ password, updatedAt: now })
        .where(
          and(
            eq(account.userId, person.id),
            eq(account.providerId, "credential"),
          ),
        );
      await tx.delete(twoFactor).where(eq(twoFactor.userId, person.id));
      await tx.delete(passkey).where(eq(passkey.userId, person.id));
      await tx.delete(session).where(eq(session.userId, person.id));
      await tx.delete(verification).where(eq(verification.value, person.id));
      await tx
        .update(user)
        .set({
          twoFactorEnabled: false,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(
            now.getTime() + TEMPORARY_PASSWORD_LIFETIME_MS,
          ),
          updatedAt: now,
        })
        .where(eq(user.id, person.id));
      await tx
        .update(factorRecovery)
        .set({
          completedAt: now,
          approvedBy: actor.id,
          approvalEvidence: evidence,
        })
        .where(eq(factorRecovery.id, id));
      return person;
    });
    if (!target)
      throw new ConflictException(
        "Account security changed. Verify identity and start a new request.",
      );
    const onboarding = await this.onboarding.deliverRecoveryPassword(
      target,
      temporaryPassword,
      id,
    );
    await this.audit.record({
      actorId: actor.id,
      targetUserId: target.id,
      type: "user.factor-recovery.completed",
      detail: `${id}: ${evidence}`,
    });
    return { temporaryPassword, onboarding };
  }

  /**
   * One session, by id, so the operator never holds its token. The owner is
   * read from the stored row, and the same rule as every targeted admin route
   * keeps a privileged account's sessions to a super administrator.
   */
  async revokeSession(sessionId: string, actor: IdentityOperator) {
    const [owner] = await this.database
      .select({ id: user.id, role: user.role })
      .from(session)
      .innerJoin(user, eq(user.id, session.userId))
      .where(eq(session.id, sessionId));
    if (!owner) throw new NotFoundException("Session not found.");
    if (!canManageTarget(actor.role, owner.role))
      throw new ForbiddenException({
        code: "PRIVILEGED_TARGET_REQUIRES_SUPER_ADMIN",
        message: "Only a super administrator can manage a privileged account.",
      });
    await this.database.delete(session).where(eq(session.id, sessionId));
    await this.audit.record({
      actorId: actor.id,
      detail: sessionId,
      targetUserId: owner.id,
      type: "user.session.revoked",
    });
    return { revoked: true };
  }

  async offboard(userId: string, detail: string, actor: IdentityOperator) {
    requireVerifiedOperator(actor);
    if (
      !rolesOf(actor.role).some((role) =>
        ["admin", "super-admin"].includes(role),
      )
    )
      throw new ForbiddenException();
    if (actor.id === userId)
      throw new ForbiddenException(
        "Another administrator must offboard your account.",
      );
    await this.retire(userId, detail, actor.id, (target) => {
      if (!canManageTarget(actor.role, target.role))
        throw new ForbiddenException(
          "Only a super administrator may offboard privileged accounts.",
        );
    });
    return { offboarded: true };
  }

  /**
   * Suspend the account, drop its sessions and memberships, and record why.
   * `offboard` reaches it after an operator's checks; the HR sync reaches it
   * with no actor, because the leaving date in the HR record is the authority.
   * The last active super administrator is protected either way.
   */
  async retire(
    userId: string,
    detail: string,
    actorId: string | null,
    authorize?: (target: typeof user.$inferSelect) => void,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .for("update");
      if (!target) throw new NotFoundException("Person not found.");
      authorize?.(target);
      if (isSuperAdmin(target.role)) {
        const active = await tx
          .select({ id: user.id, role: user.role })
          .from(user)
          .where(eq(user.banned, false));
        if (
          active.filter((row) => row.id !== target.id && isSuperAdmin(row.role))
            .length === 0
        )
          throw new ConflictException(
            "Keep another active administrator available.",
          );
      }
      await tx
        .update(user)
        .set({
          banned: true,
          banReason: detail,
          banExpires: null,
          role: "user",
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
      await tx.delete(session).where(eq(session.userId, userId));
      await tx.delete(verification).where(eq(verification.value, userId));
      await tx.delete(teamMember).where(eq(teamMember.userId, userId));
      await tx.delete(member).where(eq(member.userId, userId));
    });
    await this.audit.record({
      actorId,
      targetUserId: userId,
      type: "user.offboarded",
      detail,
    });
  }
}
