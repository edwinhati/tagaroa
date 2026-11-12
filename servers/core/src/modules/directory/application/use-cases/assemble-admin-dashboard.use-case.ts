import { Inject, Injectable } from "@nestjs/common";
import { reviewWeekStart } from "@repo/contracts/identity";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../../audit/application/audit.facade";
import {
  ACCESS_REVIEW_REPOSITORY,
  type AccessReviewRepository,
} from "../../domain/repositories/access-review.repository";
import {
  PERSON_REPOSITORY,
  type PersonRepository,
} from "../../domain/repositories/person.repository";
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from "../../domain/repositories/session.repository";
import {
  SUBSIDIARY_REPOSITORY,
  type SubsidiaryRepository,
} from "../../domain/repositories/subsidiary.repository";
import { attentionFor } from "../../domain/services/attention.service";
import { privilegedAccess } from "../../domain/services/privileged-access.service";
import {
  timeline,
  TIMELINE_DEPTH,
} from "../../domain/services/timeline.service";
import type { DashboardModel } from "../dto/group-snapshot.dto";

/**
 * What an operator sees when they open the back office.
 *
 * Seven reads and three rules. The reads are ports, so the rules — which
 * account needs attention, whether this week's review still stands, what the
 * timeline reads as — are all reachable from a test with no database, no
 * session and no route.
 */
@Injectable()
export class AssembleAdminDashboardUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly people: PersonRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SUBSIDIARY_REPOSITORY)
    private readonly subsidiaries: SubsidiaryRepository,
    @Inject(ACCESS_REVIEW_REPOSITORY)
    private readonly reviews: AccessReviewRepository,
    @Inject(AUDIT_TRAIL) private readonly trail: AuditTrail,
  ) {}

  async execute(now: Date): Promise<DashboardModel> {
    const weekStart = reviewWeekStart(now);

    const [
      people,
      activity,
      membershipIds,
      reviews,
      events,
      signIns,
      organizations,
      linkedAccounts,
    ] = await Promise.all([
      this.people.listAll(),
      this.sessions.activityAt(now),
      this.subsidiaries.membershipUserIds(),
      this.reviews.listAll(),
      this.trail.recent(TIMELINE_DEPTH),
      this.sessions.listSignIns(TIMELINE_DEPTH),
      this.subsidiaries.countSubsidiaries(),
      this.people.countLinkedAccounts(),
    ]);

    const activityByPerson = new Map(activity.map((row) => [row.userId, row]));
    const attention = attentionFor(people, membershipIds, now);
    const privileged = privilegedAccess(people, reviews, weekStart);

    return {
      accessReview: {
        people: privileged,
        reviewed: privileged.filter((person) => person.reviewed).length,
        total: privileged.length,
        weekStartedAt: weekStart,
      },
      attention,
      counts: {
        linkedAccounts,
        organizations,
        users: people.length,
      },
      events: timeline(events, signIns, people),
      people: people.map((person) => {
        const seen = activityByPerson.get(person.id);
        return {
          activeSessions: seen?.activeSessions ?? 0,
          attention: attention
            .filter((issue) => issue.userId === person.id)
            .map((issue) => issue.kind),
          lastActiveAt: seen?.lastActiveAt ?? null,
          userId: person.id,
        };
      }),
    };
  }
}
