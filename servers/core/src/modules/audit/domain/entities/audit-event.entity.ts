import { randomUUID } from "node:crypto";

/** What a caller may state about an act. The id and the clock are not theirs. */
export interface RecordEventInput {
  /** Who did it. Null only for something the service did on nobody's behalf. */
  actorId: string | null;
  type: string;
  targetUserId?: string;
  /** Whatever the type needs to be legible later: a team id, a deleted user id. */
  detail?: string;
}

interface AuditEventProps {
  id: string;
  type: string;
  actorId: string | null;
  targetUserId: string | null;
  detail: string | null;
  /** Null until Postgres has stamped it. See `record` below. */
  createdAt: Date | null;
}

/**
 * An act worth keeping evidence of.
 *
 * The entity owns the two things a caller must not choose. The id is generated
 * here, which is why `randomUUID()` appears at no call site; the timestamp is
 * left null on the way in and stamped by the column's `defaultNow()`, so the
 * time an event carries is the database's and not whichever process happened to
 * record it.
 *
 * A type is required and non-empty because an untyped event is a row nobody can
 * search for later, which is the only thing the trail is for.
 */
export class AuditEvent {
  private constructor(private readonly props: AuditEventProps) {}

  /** A new act, not yet written. */
  static record(input: RecordEventInput): AuditEvent {
    const type = input.type.trim();
    if (type.length === 0) {
      throw new Error("An audit event needs a type");
    }

    return new AuditEvent({
      actorId: input.actorId,
      createdAt: null,
      detail: input.detail ?? null,
      id: randomUUID(),
      targetUserId: input.targetUserId ?? null,
      type,
    });
  }

  /** One already written, as read back. */
  static restore(props: AuditEventProps & { createdAt: Date }): AuditEvent {
    return new AuditEvent(props);
  }

  get id(): string {
    return this.props.id;
  }

  get type(): string {
    return this.props.type;
  }

  get actorId(): string | null {
    return this.props.actorId;
  }

  get targetUserId(): string | null {
    return this.props.targetUserId;
  }

  get detail(): string | null {
    return this.props.detail;
  }

  /** Null on an event that has not been written yet. */
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
}
