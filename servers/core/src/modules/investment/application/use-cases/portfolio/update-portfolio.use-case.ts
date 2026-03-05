import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import { Portfolio } from "../../../domain/portfolio/entities/portfolio.entity";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";
import type { UpdatePortfolioDto } from "../../dtos/portfolio/update-portfolio.dto";

@Injectable()
export class UpdatePortfolioUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;

  async execute(
    id: string,
    dto: UpdatePortfolioDto,
    userId: string,
  ): Promise<Portfolio> {
    const existing = await this.portfolioRepository.findById(id);
    if (!existing) {
      throw new PortfolioNotFoundException(id);
    }
    if (existing.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const updated = new Portfolio(
      existing.id,
      existing.userId,
      dto.name ?? existing.name,
      existing.mode,
      existing.initialCapital,
      existing.currency,
      dto.status ?? existing.status,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
      existing.version,
    );

    return this.portfolioRepository.update(updated);
  }
}
