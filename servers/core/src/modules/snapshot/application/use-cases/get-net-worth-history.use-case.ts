import { Inject, Injectable } from "@nestjs/common";
import type { NetWorthSnapshot } from "../../domain/entities/net-worth-snapshot.entity";
import {
  type INetWorthSnapshotRepository,
  NET_WORTH_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/net-worth-snapshot.repository.interface";

export interface GetNetWorthHistoryDto {
  userId: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class GetNetWorthHistoryUseCase {
  constructor(
    @Inject(NET_WORTH_SNAPSHOT_REPOSITORY)
    private readonly snapshotRepository: INetWorthSnapshotRepository,
  ) {}

  async execute(dto: GetNetWorthHistoryDto): Promise<NetWorthSnapshot[]> {
    return this.snapshotRepository.findByUserIdAndDateRange(
      dto.userId,
      dto.startDate,
      dto.endDate,
    );
  }
}
