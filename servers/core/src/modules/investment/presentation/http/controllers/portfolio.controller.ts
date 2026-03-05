import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  buildJsonApiResponse,
  buildPaginationInfo,
  parsePaginationParams,
} from "../../../../../shared/types/pagination";
import type { CreatePortfolioDto } from "../../../application/dtos/portfolio/create-portfolio.dto";
import { toPortfolioResponse } from "../../../application/dtos/portfolio/portfolio-response.dto";
import type { UpdatePortfolioDto } from "../../../application/dtos/portfolio/update-portfolio.dto";
import { CreatePortfolioUseCase } from "../../../application/use-cases/portfolio/create-portfolio.use-case";
import { DeletePortfolioUseCase } from "../../../application/use-cases/portfolio/delete-portfolio.use-case";
import { GetPortfolioUseCase } from "../../../application/use-cases/portfolio/get-portfolio.use-case";
import { ListPortfoliosUseCase } from "../../../application/use-cases/portfolio/list-portfolios.use-case";
import { UpdatePortfolioUseCase } from "../../../application/use-cases/portfolio/update-portfolio.use-case";

@Controller("investment/portfolios")
export class PortfolioController {
  constructor(
    private readonly createPortfolioUseCase: CreatePortfolioUseCase,
    private readonly listPortfoliosUseCase: ListPortfoliosUseCase,
    private readonly getPortfolioUseCase: GetPortfolioUseCase,
    private readonly updatePortfolioUseCase: UpdatePortfolioUseCase,
    private readonly deletePortfolioUseCase: DeletePortfolioUseCase,
  ) {}

  @Get()
  async list(
    @Session() session: UserSession,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const pagination = parsePaginationParams({ page, limit });
    const result = await this.listPortfoliosUseCase.execute(
      session.user.id,
      pagination,
    );
    const data = result.items.map(toPortfolioResponse);
    const paginationInfo = buildPaginationInfo(
      pagination.page,
      pagination.limit,
      result.total,
    );
    return buildJsonApiResponse(data, paginationInfo);
  }

  @Post()
  async create(
    @Session() session: UserSession,
    @Body() dto: CreatePortfolioDto,
  ) {
    const portfolio = await this.createPortfolioUseCase.execute(
      dto,
      session.user.id,
    );
    return toPortfolioResponse(portfolio);
  }

  @Get(":id")
  async get(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    const portfolio = await this.getPortfolioUseCase.execute(
      id,
      session.user.id,
    );
    return toPortfolioResponse(portfolio);
  }

  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: UpdatePortfolioDto,
  ) {
    const portfolio = await this.updatePortfolioUseCase.execute(
      id,
      dto,
      session.user.id,
    );
    return toPortfolioResponse(portfolio);
  }

  @Delete(":id")
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    await this.deletePortfolioUseCase.execute(id, session.user.id);
    return { message: "Portfolio deleted successfully" };
  }
}
