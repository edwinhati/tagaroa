import type {
  AttentionIssue,
  AttentionKind,
} from "../../domain/entities/person.entity";
import type { PositionRecord } from "../../domain/repositories/position.repository";
import type { PrivilegedPerson } from "../../domain/services/privileged-access.service";
import type { TimelineEntry } from "../../domain/services/timeline.service";

/**
 * What leaves the application layer.
 *
 * Plain data, never entities. The HTTP surface pages and serialises these, and
 * `apps/admin` reads them; an entity crossing that line would put the group's
 * rules inside a JSON response and make every field rename a breaking change.
 */
export interface DirectorySubsidiary {
  id: string;
  memberIds: string[];
  name: string;
  slug: string;
}

export interface DirectoryTeam {
  id: string;
  name: string;
  organizationId: string;
  memberIds: string[];
}

export interface GroupSnapshot {
  positions: PositionRecord[];
  subsidiaries: DirectorySubsidiary[];
  teams: DirectoryTeam[];
}

export interface PersonActivityView {
  userId: string;
  activeSessions: number;
  lastActiveAt: Date | null;
  attention: AttentionKind[];
}

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
