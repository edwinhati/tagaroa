import type { AttentionKind } from "@repo/contracts/identity";

/**
 * What `/api/directory` answers with. Core's directory module is typed with
 * these, so admin reads what core actually sends.
 */

export interface DirectorySubsidiary {
  id: string;
  memberIds: string[];
  name: string;
  slug: string;
}

export interface DirectoryTeam {
  id: string;
  memberIds: string[];
  name: string;
  organizationId: string;
}

/** A title and reporting line, group-wide or in one subsidiary. */
export interface PositionRecord {
  id: string;
  managerUserId: string | null;
  organizationId: string | null;
  title: string;
  updatedAt: Date;
  updatedBy: string | null;
  userId: string;
}

export interface GroupSnapshot {
  positions: PositionRecord[];
  subsidiaries: DirectorySubsidiary[];
  teams: DirectoryTeam[];
}

/** One identity provider a person can sign in with. */
export interface LinkedAccount {
  accountId: string;
  createdAt: Date;
  id: string;
  providerId: string;
}

export interface AttentionIssue {
  ageDays: number;
  email: string;
  kind: AttentionKind;
  name: string;
  userId: string;
}

export interface PrivilegedPerson {
  email: string;
  name: string;
  reviewed: boolean;
  reviewedAt: Date | null;
  role: string;
  userId: string;
}

export interface TimelineEntry {
  actor: string;
  at: Date;
  detail: string | null;
  id: string;
  target: string | null;
  type: string;
}

export interface PersonActivityView {
  activeSessions: number;
  attention: AttentionKind[];
  lastActiveAt: Date | null;
  userId: string;
}

/** The back office overview, before the server pages its lists. */
export interface DashboardModel {
  accessReview: {
    people: PrivilegedPerson[];
    reviewed: number;
    total: number;
    weekStartedAt: Date;
  };
  attention: AttentionIssue[];
  counts: { linkedAccounts: number; organizations: number; users: number };
  events: TimelineEntry[];
  people: PersonActivityView[];
}
