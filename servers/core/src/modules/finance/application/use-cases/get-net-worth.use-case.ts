import { Inject, Injectable } from "@nestjs/common";
import {
  ASSET_REPOSITORY,
  type IAssetRepository,
} from "../../domain/repositories/asset.repository.interface";
import {
  type ILiabilityRepository,
  LIABILITY_REPOSITORY,
} from "../../domain/repositories/liability.repository.interface";
import {
  type INetWorthSnapshotRepository,
  NET_WORTH_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/net-worth-snapshot.repository.interface";
import type { GetNetWorthDto } from "../dtos/dashboard/get-net-worth.dto";
import type {
  NetWorthResponseDto,
  NetWorthSnapshotDto,
} from "../dtos/dashboard/net-worth-response.dto";

@Injectable()
export class GetNetWorthUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    @Inject(LIABILITY_REPOSITORY)
    private readonly liabilityRepository: ILiabilityRepository,
    @Inject(NET_WORTH_SNAPSHOT_REPOSITORY)
    private readonly snapshotRepository: INetWorthSnapshotRepository,
  ) {}

  async execute(
    userId: string,
    dto: GetNetWorthDto,
  ): Promise<NetWorthResponseDto> {
    const currency = dto.currency || "IDR";

    // Calculate current net worth
    const [totalAssets, totalLiabilities] = await Promise.all([
      this.assetRepository.getTotalValue(userId, currency),
      this.liabilityRepository.getTotalAmount(userId, currency),
    ]);

    const currentNetWorth = totalAssets - totalLiabilities;

    // Fetch historical snapshots if date range provided
    let snapshots: NetWorthSnapshotDto[] = [];
    if (dto.start_date && dto.end_date) {
      const startDate = new Date(dto.start_date);
      const endDate = new Date(dto.end_date);

      const historicalSnapshots =
        await this.snapshotRepository.findByUserIdAndDateRange(
          userId,
          startDate,
          endDate,
        );

      snapshots = historicalSnapshots.map((snapshot) => ({
        date: snapshot.snapshotDate.toISOString().slice(0, 10),
        total_assets: snapshot.totalAssets,
        total_liabilities: snapshot.totalLiabilities,
        net_worth: snapshot.netWorth,
      }));
    }

    return {
      current_net_worth: currentNetWorth,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      currency,
      snapshots,
    };
  }
}
