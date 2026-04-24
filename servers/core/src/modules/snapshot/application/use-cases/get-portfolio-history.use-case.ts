import { Inject, Injectable } from "@nestjs/common";
import type { PortfolioSnapshot } from "../../domain/entities/portfolio-snapshot.entity";
import {
  type IPortfolioSnapshotRepository,
  PORTFOLIO_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/portfolio-snapshot.repository.interface";

export interface GetPortfolioHistoryDto {
  portfolioId: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class GetPortfolioHistoryUseCase {
  constructor(
    @Inject(PORTFOLIO_SNAPSHOT_REPOSITORY)
    private readonly snapshotRepository: IPortfolioSnapshotRepository,
  ) {}

  async execute(dto: GetPortfolioHistoryDto): Promise<PortfolioSnapshot[]> {
    return this.snapshotRepository.findByPortfolioIdInRange(
      dto.portfolioId,
      dto.startDate,
      dto.endDate,
    );
  }
}
