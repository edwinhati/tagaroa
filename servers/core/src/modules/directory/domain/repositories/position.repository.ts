export const POSITION_REPOSITORY = Symbol("POSITION_REPOSITORY");

export interface PositionRecord {
  id: string;
  managerUserId: string | null;
  organizationId: string | null;
  title: string;
  updatedAt: Date;
  updatedBy: string | null;
  userId: string;
}

export interface PositionRepository {
  list(): Promise<PositionRecord[]>;
  /** Positions recorded for one person (group and subsidiary scopes). */
  listForUser(userId: string): Promise<PositionRecord[]>;
  remove(userId: string, organizationId: string | null): Promise<boolean>;
  save(input: {
    actorId: string;
    id: string;
    managerUserId: string | null;
    organizationId: string | null;
    title: string;
    userId: string;
  }): Promise<PositionRecord>;
}
