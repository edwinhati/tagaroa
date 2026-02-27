import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { toCashFlowResponse } from "../../../application/dtos/portfolio/cash-flow-response.dto";
import { RecordCashFlowDto } from "../../../application/dtos/portfolio/record-cash-flow.dto";
import { DeleteCashFlowUseCase } from "../../../application/use-cases/portfolio/delete-cash-flow.use-case";
import { ListCashFlowsUseCase } from "../../../application/use-cases/portfolio/list-cash-flows.use-case";
import { RecordCashFlowUseCase } from "../../../application/use-cases/portfolio/record-cash-flow.use-case";

@Controller("investment/portfolios/:portfolioId/cash-flows")
export class CashFlowController {
  constructor(
    private readonly recordCashFlowUseCase: RecordCashFlowUseCase,
    private readonly listCashFlowsUseCase: ListCashFlowsUseCase,
    private readonly deleteCashFlowUseCase: DeleteCashFlowUseCase,
  ) {}

  @Post()
  async record(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
    @Body() dto: RecordCashFlowDto,
  ) {
    const cashFlow = await this.recordCashFlowUseCase.execute(
      portfolioId,
      dto,
      session.user.id,
    );
    return toCashFlowResponse(cashFlow);
  }

  @Get()
  async list(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
    @Query("offset") offset?: string,
    @Query("limit") limit?: string,
  ) {
    const cashFlows = await this.listCashFlowsUseCase.execute(
      portfolioId,
      session.user.id,
      offset ? Number(offset) : 0,
      limit ? Number(limit) : 50,
    );
    return cashFlows.map(toCashFlowResponse);
  }

  @Delete(":cashFlowId")
  async delete(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Param("cashFlowId", ParseUUIDPipe) cashFlowId: string,
    @Session() session: UserSession,
  ) {
    await this.deleteCashFlowUseCase.execute(
      portfolioId,
      cashFlowId,
      session.user.id,
    );
    return { deleted: true };
  }
}
