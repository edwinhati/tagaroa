import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../../audit/application/audit.facade";
import {
  PERSON_REPOSITORY,
  type PersonRepository,
} from "../../domain/repositories/person.repository";
import {
  POSITION_REPOSITORY,
  type PositionRecord,
  type PositionRepository,
} from "../../domain/repositories/position.repository";
import {
  SUBSIDIARY_REPOSITORY,
  type SubsidiaryRepository,
} from "../../domain/repositories/subsidiary.repository";

@Injectable()
export class ManagePositionUseCase {
  constructor(
    @Inject(POSITION_REPOSITORY)
    private readonly positions: PositionRepository,
    @Inject(PERSON_REPOSITORY) private readonly people: PersonRepository,
    @Inject(SUBSIDIARY_REPOSITORY)
    private readonly subsidiaries: SubsidiaryRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  private async assertPeopleInScope(
    userId: string,
    managerUserId: string | null,
    organizationId: string | null,
  ): Promise<void> {
    const people = await this.people.listAll();
    const ids = new Set(people.map((person) => person.id));
    if (!ids.has(userId)) throw new NotFoundException("Person not found.");
    if (managerUserId && !ids.has(managerUserId)) {
      throw new NotFoundException("Manager not found.");
    }
    if (!organizationId) return;
    const memberships = await this.subsidiaries.memberIdsBySubsidiary();
    const members = new Set(memberships.get(organizationId) ?? []);
    if (
      !members.has(userId) ||
      (managerUserId && !members.has(managerUserId))
    ) {
      throw new BadRequestException(
        "The person and manager must belong to this subsidiary.",
      );
    }
  }

  private async assertAcyclic(
    userId: string,
    managerUserId: string | null,
    organizationId: string | null,
  ): Promise<void> {
    if (!managerUserId) return;
    if (managerUserId === userId) {
      throw new BadRequestException("A person cannot report to themselves.");
    }
    const positions = await this.positions.list();
    const managers = new Map(
      positions
        .filter((position) => position.organizationId === organizationId)
        .map((position) => [position.userId, position.managerUserId]),
    );
    managers.set(userId, managerUserId);
    const seen = new Set<string>([userId]);
    let current: string | null | undefined = managerUserId;
    while (current) {
      if (seen.has(current)) {
        throw new BadRequestException(
          "This reporting line would create a cycle.",
        );
      }
      seen.add(current);
      current = managers.get(current);
    }
  }

  async save(input: {
    actorId: string;
    managerUserId: string | null;
    organizationId: string | null;
    title: string;
    userId: string;
  }): Promise<PositionRecord> {
    await this.assertPeopleInScope(
      input.userId,
      input.managerUserId,
      input.organizationId,
    );
    await this.assertAcyclic(
      input.userId,
      input.managerUserId,
      input.organizationId,
    );
    const position = await this.positions.save({
      ...input,
      id: randomUUID(),
    });
    await this.audit.record({
      actorId: input.actorId,
      detail: `${input.organizationId ?? "group"}: ${position.title}`,
      targetUserId: input.userId,
      type: "directory.position.updated",
    });
    return position;
  }

  async remove(input: {
    actorId: string;
    organizationId: string | null;
    userId: string;
  }): Promise<{ removed: true }> {
    if (!(await this.positions.remove(input.userId, input.organizationId))) {
      throw new NotFoundException("Position not found.");
    }
    await this.audit.record({
      actorId: input.actorId,
      detail: input.organizationId ?? "group",
      targetUserId: input.userId,
      type: "directory.position.removed",
    });
    return { removed: true };
  }
}
