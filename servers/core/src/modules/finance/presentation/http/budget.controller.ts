import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import {
  buildJsonApiResponse,
  buildPaginationInfo,
  parsePaginationParams,
} from "../../../../shared/types/pagination";
import {
  toBudgetItemResponse,
  toBudgetResponse,
} from "../../application/dtos/budget-response.dto";
import type { CreateBudgetDto } from "../../application/dtos/create-budget.dto";
import type { UpdateBudgetDto } from "../../application/dtos/update-budget.dto";
import type { UpdateBudgetItemDto } from "../../application/dtos/update-budget-item.dto";
import { CreateBudgetUseCase } from "../../application/use-cases/create-budget.use-case";
import { DeleteBudgetUseCase } from "../../application/use-cases/delete-budget.use-case";
import { GetBudgetByMonthYearUseCase } from "../../application/use-cases/get-budget-by-month-year.use-case";
import { GetBudgetsUseCase } from "../../application/use-cases/get-budgets.use-case";
import { UpdateBudgetUseCase } from "../../application/use-cases/update-budget.use-case";
import { UpdateBudgetItemUseCase } from "../../application/use-cases/update-budget-item.use-case";
import { getDefaultCategories } from "../../domain/value-objects/budget-category";

@Controller("finance/budgets")
export class BudgetController {
  constructor(
    private readonly getBudgetsUseCase: GetBudgetsUseCase,
    private readonly getBudgetByMonthYearUseCase: GetBudgetByMonthYearUseCase,
    private readonly createBudgetUseCase: CreateBudgetUseCase,
    private readonly updateBudgetUseCase: UpdateBudgetUseCase,
    private readonly updateBudgetItemUseCase: UpdateBudgetItemUseCase,
    private readonly deleteBudgetUseCase: DeleteBudgetUseCase,
  ) {}

  @Get("categories")
  @AllowAnonymous()
  getCategories() {
    return getDefaultCategories();
  }

  @Get()
  async getBudgets(
    @Session() session: UserSession,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const pagination = parsePaginationParams({ page, limit });
    const result = await this.getBudgetsUseCase.execute(
      session.user.id,
      pagination,
    );
    const data = result.items.map(({ budget, items }) =>
      toBudgetResponse(budget, items),
    );
    const paginationInfo = buildPaginationInfo(
      pagination.page,
      pagination.limit,
      result.total,
    );
    return buildJsonApiResponse(data, paginationInfo);
  }

  @Get(":month/:year")
  async getBudgetByMonthYear(
    @Param("month", ParseIntPipe) month: number,
    @Param("year", ParseIntPipe) year: number,
    @Session() session: UserSession,
  ) {
    if (month < 1 || month > 12) {
      throw new BadRequestException("Month must be between 1 and 12");
    }
    if (year < 2000 || year > 2100) {
      throw new BadRequestException("Year must be between 2000 and 2100");
    }

    const result = await this.getBudgetByMonthYearUseCase.execute(
      session.user.id,
      month,
      year,
    );

    if (!result) {
      return { data: null, meta: { message: "Budget not found" } };
    }

    return {
      data: toBudgetResponse(result.budget, result.items),
    };
  }

  @Post()
  async createBudget(
    @Session() session: UserSession,
    @Body() dto: CreateBudgetDto,
  ) {
    const { budget, items } = await this.createBudgetUseCase.execute(
      dto,
      session.user.id,
    );
    return toBudgetResponse(budget, items);
  }

  @Patch(":id")
  async updateBudget(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: UpdateBudgetDto,
  ) {
    const budget = await this.updateBudgetUseCase.execute(
      id,
      dto,
      session.user.id,
    );
    return toBudgetResponse(budget, null);
  }

  @Patch("items/:itemId")
  async updateBudgetItem(
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Session() session: UserSession,
    @Body() dto: UpdateBudgetItemDto,
  ) {
    const item = await this.updateBudgetItemUseCase.execute(
      itemId,
      dto,
      session.user.id,
    );
    return toBudgetItemResponse(item);
  }

  @Delete(":id")
  async deleteBudget(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    await this.deleteBudgetUseCase.execute(id, session.user.id);
    return { message: "Budget deleted successfully" };
  }
}
