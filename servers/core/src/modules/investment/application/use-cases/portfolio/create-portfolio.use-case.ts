import { Inject, Injectable } from "@nestjs/common";
import { Portfolio } from "../../../domain/portfolio/entities/portfolio.entity";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";
import { PortfolioStatus } from "../../../domain/value-objects/portfolio-status.value-object";
import type { CreatePortfolioDto } from "../../dtos/portfolio/create-portfolio.dto";

@Injectable()
export class CreatePortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
  ) {}

  async execute(dto: CreatePortfolioDto, userId: string): Promise<Portfolio> {
    const now = new Date();
    const portfolio = new Portfolio(
      crypto.randomUUID(),
      userId,
      dto.name,
      dto.mode,
      dto.initialCapital,
      dto.currency.toUpperCase(),
      PortfolioStatus.ACTIVE,
      null,
      now,
      now,
      1,
    );

    return this.portfolioRepository.create(portfolio);
  }
}
