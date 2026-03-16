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
  type AccountResponseDto,
  toAccountResponse,
} from "../../application/dtos/account-response.dto";
import type { CreateAccountDto } from "../../application/dtos/create-account.dto";
import type { UpdateAccountDto } from "../../application/dtos/update-account.dto";
import { CreateAccountUseCase } from "../../application/use-cases/create-account.use-case";
import { DeleteAccountUseCase } from "../../application/use-cases/delete-account.use-case";
import { GetAccountUseCase } from "../../application/use-cases/get-account.use-case";
import { GetAccountsUseCase } from "../../application/use-cases/get-accounts.use-case";
import { UpdateAccountUseCase } from "../../application/use-cases/update-account.use-case";
import {
  AccountCategory,
  isValidAccountCategory,
} from "../../domain/value-objects/account-category";
import { AccountType } from "../../domain/value-objects/account-type";

@Controller("finance/accounts")
export class AccountController {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly getAccountsUseCase: GetAccountsUseCase,
    private readonly getAccountUseCase: GetAccountUseCase,
    private readonly updateAccountUseCase: UpdateAccountUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
  ) {}

  @Get("types")
  @AllowAnonymous()
  getAccountTypes() {
    return Object.values(AccountType);
  }

  @Get("categories")
  @AllowAnonymous()
  getAccountCategories() {
    return Object.values(AccountCategory);
  }

  @Get()
  async getAccounts(
    @Session() session: UserSession,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("type") type?: string,
    @Query("category") category?: string,
  ) {
    const pagination = parsePaginationParams({ page, limit });
    const filters = {
      search: search || undefined,
      types: type
        ? type
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      categories: category
        ? category
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(
              (
                c,
              ): c is (typeof AccountCategory)[keyof typeof AccountCategory] =>
                isValidAccountCategory(c),
            )
        : undefined,
    };
    const result = await this.getAccountsUseCase.execute(
      session.user.id,
      pagination,
      filters,
    );
    const data = result.items.map(toAccountResponse);
    const paginationInfo = buildPaginationInfo(
      pagination.page,
      pagination.limit,
      result.total,
    );
    return buildJsonApiResponse(data, paginationInfo, result.aggregations);
  }

  @Post()
  async createAccount(
    @Session() session: UserSession,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.createAccountUseCase.execute(
      dto,
      session.user.id,
    );
    return toAccountResponse(account);
  }

  @Get(":id")
  async getAccount(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ): Promise<AccountResponseDto> {
    const account = await this.getAccountUseCase.execute(id, session.user.id);
    return toAccountResponse(account);
  }

  @Patch(":id")
  async updateAccount(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.updateAccountUseCase.execute(
      id,
      dto,
      session.user.id,
    );
    return toAccountResponse(account);
  }

  @Delete(":id")
  async deleteAccount(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    await this.deleteAccountUseCase.execute(id, session.user.id);
    return { message: "Account deleted successfully" };
  }
}
