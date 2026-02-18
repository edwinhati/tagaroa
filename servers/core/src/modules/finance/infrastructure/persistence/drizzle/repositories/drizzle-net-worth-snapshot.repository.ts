import { Inject, Injectable } from "@nestjs/common";
import { and, asc, between, desc, eq, isNull } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import { NetWorthSnapshot } from "../../../../domain/entities/net-worth-snapshot.entity";
import type { INetWorthSnapshotRepository } from "../../../../domain/repositories/net-worth-snapshot.repository.interface";
import { NetWorthSnapshotMapper } from "../mappers/net-worth-snapshot.mapper";
import { netWorthSnapshots } from "../schemas/net-worth-snapshot.schema";

@Injectable()
export class DrizzleNetWorthSnapshotRepository
  implements INetWorthSnapshotRepository
{
  constructor(@Inject(DRIZZLE) private readonly db: BunSQLDatabase) {}

  async findByUserId(userId: string): Promise<NetWorthSnapshot[]> {
    const rows = await this.db
      .select()
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId))
      .orderBy(asc(netWorthSnapshots.snapshotDate));

    return rows.map(NetWorthSnapshotMapper.toDomain);
  }

  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NetWorthSnapshot[]> {
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const rows = await this.db
      .select()
      .from(netWorthSnapshots)
      .where(
        and(
          eq(netWorthSnapshots.userId, userId),
          between(netWorthSnapshots.snapshotDate, startDateStr, endDateStr),
        ),
      )
      .orderBy(asc(netWorthSnapshots.snapshotDate));

    return rows.map(NetWorthSnapshotMapper.toDomain);
  }

  async findLatestByUserId(userId: string): Promise<NetWorthSnapshot | null> {
    const [row] = await this.db
      .select()
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId))
      .orderBy(desc(netWorthSnapshots.snapshotDate))
      .limit(1);

    return row ? NetWorthSnapshotMapper.toDomain(row) : null;
  }

  async create(snapshot: NetWorthSnapshot): Promise<NetWorthSnapshot> {
    const [row] = await this.db
      .insert(netWorthSnapshots)
      .values(NetWorthSnapshotMapper.toPersistence(snapshot))
      .returning();

    if (!row) {
      throw new Error("Failed to create net worth snapshot");
    }
    return NetWorthSnapshotMapper.toDomain(row);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .delete(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId));
  }
}
