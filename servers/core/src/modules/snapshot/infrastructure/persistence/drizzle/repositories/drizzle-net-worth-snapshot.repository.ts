import { and, asc, between, desc, eq } from "drizzle-orm";
import { DrizzleBaseRepository } from "../../../../../../shared/database/drizzle-base.repository";
import type { NetWorthSnapshot } from "../../../../domain/entities/net-worth-snapshot.entity";
import type { INetWorthSnapshotRepository } from "../../../../domain/repositories/net-worth-snapshot.repository.interface";
import { NetWorthSnapshotMapper } from "../mappers/net-worth-snapshot.mapper";
import { netWorth } from "../schemas/net-worth.schema";

export class DrizzleNetWorthSnapshotRepository
  extends DrizzleBaseRepository
  implements INetWorthSnapshotRepository
{
  async findByUserId(userId: string): Promise<NetWorthSnapshot[]> {
    const rows = await this.getDb()
      .select()
      .from(netWorth)
      .where(eq(netWorth.userId, userId))
      .orderBy(asc(netWorth.snapshotDate));

    return rows.map(NetWorthSnapshotMapper.toDomain);
  }

  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NetWorthSnapshot[]> {
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const rows = await this.getDb()
      .select()
      .from(netWorth)
      .where(
        and(
          eq(netWorth.userId, userId),
          between(netWorth.snapshotDate, startDateStr, endDateStr),
        ),
      )
      .orderBy(asc(netWorth.snapshotDate));

    return rows.map(NetWorthSnapshotMapper.toDomain);
  }

  async findLatestByUserId(userId: string): Promise<NetWorthSnapshot | null> {
    const [row] = await this.getDb()
      .select()
      .from(netWorth)
      .where(eq(netWorth.userId, userId))
      .orderBy(desc(netWorth.snapshotDate))
      .limit(1);

    return row ? NetWorthSnapshotMapper.toDomain(row) : null;
  }

  async create(snapshot: NetWorthSnapshot): Promise<NetWorthSnapshot> {
    const [row] = await this.getDb()
      .insert(netWorth)
      .values(NetWorthSnapshotMapper.toPersistence(snapshot))
      .returning();

    if (!row) {
      throw new Error("Failed to create net worth snapshot");
    }
    return NetWorthSnapshotMapper.toDomain(row);
  }
}
