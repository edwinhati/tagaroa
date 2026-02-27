import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { toTradeResponse } from "../../../application/dtos/portfolio/trade-response.dto";
import { ListTradesUseCase } from "../../../application/use-cases/portfolio/list-trades.use-case";

@Controller("investment/portfolios/:portfolioId/trades")
export class TradeController {
  constructor(private readonly listTradesUseCase: ListTradesUseCase) {}

  @Get()
  async list(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
    @Query("offset") offset?: string,
    @Query("limit") limit?: string,
  ) {
    const trades = await this.listTradesUseCase.execute(
      portfolioId,
      session.user.id,
      offset ? Number(offset) : 0,
      limit ? Number(limit) : 50,
    );
    return trades.map(toTradeResponse);
  }
}
