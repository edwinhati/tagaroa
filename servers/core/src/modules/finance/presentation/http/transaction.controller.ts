import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
} from "../../../../shared/types/pagination";
import type { CreateTransactionDto } from "../../application/dtos/create-transaction.dto";
import type { GetTransactionsDto } from "../../application/dtos/get-transactions.dto";
import { toTransactionResponse } from "../../application/dtos/transaction-response.dto";
import type { UpdateTransactionDto } from "../../application/dtos/update-transaction.dto";
import { CreateTransactionUseCase } from "../../application/use-cases/create-transaction.use-case";
import { DeleteTransactionUseCase } from "../../application/use-cases/delete-transaction.use-case";
import { GetTransactionUseCase } from "../../application/use-cases/get-transaction.use-case";
import { GetTransactionTypesUseCase } from "../../application/use-cases/get-transaction-types.use-case";
import { GetTransactionsUseCase } from "../../application/use-cases/get-transactions.use-case";
import { UpdateTransactionUseCase } from "../../application/use-cases/update-transaction.use-case";

@Controller("finance/transactions")
export class TransactionController {
  constructor(
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly getTransactionUseCase: GetTransactionUseCase,
    private readonly getTransactionsUseCase: GetTransactionsUseCase,
    private readonly updateTransactionUseCase: UpdateTransactionUseCase,
    private readonly deleteTransactionUseCase: DeleteTransactionUseCase,
    private readonly getTransactionTypesUseCase: GetTransactionTypesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Session() session: UserSession,
    @Body() dto: CreateTransactionDto,
  ) {
    const transaction = await this.createTransactionUseCase.execute(
      session.user.id,
      dto,
    );
    return toTransactionResponse(transaction);
  }

  @Get()
  async findAll(
    @Session() session: UserSession,
    @Query() dto: GetTransactionsDto,
  ) {
    const result = await this.getTransactionsUseCase.execute(
      session.user.id,
      dto,
    );

    // Map to response DTOs with related data
    const data = result.items.map(({ transaction, account, budgetItem }) =>
      toTransactionResponse(transaction, account, budgetItem ?? undefined),
    );

    const paginationInfo = buildPaginationInfo(
      dto.page || 1,
      dto.limit || 20,
      result.total,
    );

    return buildJsonApiResponse(data, paginationInfo, result.aggregations);
  }

  @Get("types")
  async getTypes() {
    return this.getTransactionTypesUseCase.execute();
  }

  @Get(":id")
  async findOne(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const { transaction, account, budgetItem } =
      await this.getTransactionUseCase.execute(session.user.id, id);

    return toTransactionResponse(transaction, account, budgetItem ?? undefined);
  }

  @Patch(":id")
  async update(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    const transaction = await this.updateTransactionUseCase.execute(
      session.user.id,
      id,
      dto,
    );
    return toTransactionResponse(transaction);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.deleteTransactionUseCase.execute(session.user.id, id);
  }
}
