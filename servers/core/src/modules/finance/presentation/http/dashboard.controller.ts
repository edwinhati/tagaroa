import { Controller, Get, Query } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { buildJsonApiResponse } from "../../../../shared/types/pagination";
import { GetBudgetPerformanceDto } from "../../application/dtos/dashboard/get-budget-performance.dto";
import { GetExpenseBreakdownDto } from "../../application/dtos/dashboard/get-expense-breakdown.dto";
import { GetInsightsDto } from "../../application/dtos/dashboard/get-insights.dto";
import { GetNetWorthDto } from "../../application/dtos/dashboard/get-net-worth.dto";
import { GetSummaryDto } from "../../application/dtos/dashboard/get-summary.dto";
import { GetTransactionTrendsDto } from "../../application/dtos/dashboard/get-transaction-trends.dto";
import { GetAccountAggregationsUseCase } from "../../application/use-cases/get-account-aggregations.use-case";
import { GetBudgetPerformanceUseCase } from "../../application/use-cases/get-budget-performance.use-case";
import { GetExpenseBreakdownUseCase } from "../../application/use-cases/get-expense-breakdown.use-case";
import { GetInsightsUseCase } from "../../application/use-cases/get-insights.use-case";
import { GetNetWorthUseCase } from "../../application/use-cases/get-net-worth.use-case";
import { GetSummaryUseCase } from "../../application/use-cases/get-summary.use-case";
import { GetTransactionTrendsUseCase } from "../../application/use-cases/get-transaction-trends.use-case";

@Controller("finance/dashboard")
export class DashboardController {
  constructor(
    private readonly getSummaryUseCase: GetSummaryUseCase,
    private readonly getBudgetPerformanceUseCase: GetBudgetPerformanceUseCase,
    private readonly getExpenseBreakdownUseCase: GetExpenseBreakdownUseCase,
    private readonly getTransactionTrendsUseCase: GetTransactionTrendsUseCase,
    private readonly getAccountAggregationsUseCase: GetAccountAggregationsUseCase,
    private readonly getNetWorthUseCase: GetNetWorthUseCase,
    private readonly getInsightsUseCase: GetInsightsUseCase,
  ) {}

  @Get("summary")
  async getSummary(
    @Session() session: UserSession,
    @Query() dto: GetSummaryDto,
  ) {
    const result = await this.getSummaryUseCase.execute(session.user.id, dto);
    return buildJsonApiResponse(result);
  }

  @Get("budget-performance")
  async getBudgetPerformance(
    @Session() session: UserSession,
    @Query() dto: GetBudgetPerformanceDto,
  ) {
    const result = await this.getBudgetPerformanceUseCase.execute(
      session.user.id,
      dto,
    );
    return buildJsonApiResponse(result);
  }

  @Get("expense-breakdown")
  async getExpenseBreakdown(
    @Session() session: UserSession,
    @Query() dto: GetExpenseBreakdownDto,
  ) {
    const result = await this.getExpenseBreakdownUseCase.execute(
      session.user.id,
      dto,
    );
    return buildJsonApiResponse(result);
  }

  @Get("transaction-trends")
  async getTransactionTrends(
    @Session() session: UserSession,
    @Query() dto: GetTransactionTrendsDto,
  ) {
    const result = await this.getTransactionTrendsUseCase.execute(
      session.user.id,
      dto,
    );
    return buildJsonApiResponse(result);
  }

  @Get("account-aggregations")
  async getAccountAggregations(@Session() session: UserSession) {
    const result = await this.getAccountAggregationsUseCase.execute(
      session.user.id,
    );
    return buildJsonApiResponse(result);
  }

  @Get("net-worth")
  async getNetWorth(
    @Session() session: UserSession,
    @Query() dto: GetNetWorthDto,
  ) {
    const result = await this.getNetWorthUseCase.execute(session.user.id, dto);
    return buildJsonApiResponse(result);
  }

  @Get("insights")
  async getInsights(
    @Session() session: UserSession,
    @Query() dto: GetInsightsDto,
  ) {
    const result = await this.getInsightsUseCase.execute(session.user.id, dto);
    return buildJsonApiResponse(result);
  }
}
