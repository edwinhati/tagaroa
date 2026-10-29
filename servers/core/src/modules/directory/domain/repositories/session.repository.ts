import type { SignIn } from "../services/timeline.service";

export const SESSION_REPOSITORY = Symbol("SESSION_REPOSITORY");

export interface PersonActivity {
  userId: string;
  activeSessions: number;
  lastActiveAt: Date | null;
}

/** Who is signed in now, and who has signed in at all. */
export interface SessionRepository {
  /** Sessions not yet expired at `now`, tallied per person. */
  activityAt(now: Date): Promise<PersonActivity[]>;
  /**
   * The newest `limit` sign-ins, newest first. Every session ever opened is one
   * of these, so this is the fastest-growing table the dashboard reads.
   */
  listSignIns(limit: number): Promise<SignIn[]>;
}
