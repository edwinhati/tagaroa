import { Inject, Injectable } from "@nestjs/common";
import { DomainException } from "../../../../../shared/exceptions/domain.exception";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import {
  CASH_FLOW_REPOSITORY,
  type ICashFlowRepository,
} from "../../../domain/portfolio/repositories/cash-flow.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";

class CashFlowNotFoundException extends DomainException {
  constructor(id: string) {
    super("CASH_FLOW_NOT_FOUND", `Cash flow with id '${id}' not found`);
    this.name = "CashFlowNotFoundException";
  }
}

@Injectable()
export class DeleteCashFlowUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(CASH_FLOW_REPOSITORY)
    private readonly cashFlowRepository: ICashFlowRepository,
  ) {}

  async execute(
    portfolioId: string,
    cashFlowId: string,
    userId: string,
  ): Promise<void> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const cashFlow = await this.cashFlowRepository.findById(cashFlowId);
    if (cashFlow?.portfolioId !== portfolioId) {
      throw new CashFlowNotFoundException(cashFlowId);
    }

    await this.cashFlowRepository.delete(cashFlowId);
  }
}
