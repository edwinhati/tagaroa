import type { NetWorthSnapshot } from "../entities/net-worth-snapshot.entity";

export const NET_WORTH_SNAPSHOT_REPOSITORY = Symbol(
  "NET_WORTH_SNAPSHOT_REPOSITORY",
);

export interface INetWorthSnapshotRepository {
  findByUserId(userId: string): Promise<NetWorthSnapshot[]>;
  findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NetWorthSnapshot[]>;
  findLatestByUserId(userId: string): Promise<NetWorthSnapshot | null>;
  create(snapshot: NetWorthSnapshot): Promise<NetWorthSnapshot>;
  findUnarchivedBeforeDate(date: Date): Promise<NetWorthSnapshot[]>;
  markAsArchived(id: string, archiveKey: string): Promise<void>;
}
