import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import { CashFlow } from "../../../domain/portfolio/entities/cash-flow.entity";
import {
  CASH_FLOW_REPOSITORY,
  type ICashFlowRepository,
} from "../../../domain/portfolio/repositories/cash-flow.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";
import type { RecordCashFlowDto } from "../../dtos/portfolio/record-cash-flow.dto";

@Injectable()
export class RecordCashFlowUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(CASH_FLOW_REPOSITORY)
    private readonly cashFlowRepository: ICashFlowRepository,
  ) {}

  async execute(
    portfolioId: string,
    dto: RecordCashFlowDto,
    userId: string,
  ): Promise<CashFlow> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const now = new Date();
    const cashFlow = new CashFlow(
      crypto.randomUUID(),
      portfolioId,
      dto.type,
      dto.amount,
      dto.description ?? null,
      dto.timestamp ? new Date(dto.timestamp) : now,
      now,
    );

    return this.cashFlowRepository.create(cashFlow);
  }
}
