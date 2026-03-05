import { Inject, Injectable } from "@nestjs/common";
import { Account } from "../../domain/entities/account.entity";
import {
  AccountAccessDeniedException,
  AccountNotFoundException,
} from "../../domain/exceptions/account.exceptions";
import type { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";
import type { UpdateAccountDto } from "../dtos/update-account.dto";

@Injectable()
export class UpdateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateAccountDto,
    userId: string,
  ): Promise<Account> {
    const existing = await this.accountRepository.findById(id);

    if (!existing) {
      throw new AccountNotFoundException(id);
    }

    if (existing.userId !== userId) {
      throw new AccountAccessDeniedException();
    }

    const updated = new Account(
      existing.id,
      dto.name ?? existing.name,
      existing.type,
      dto.balance ?? existing.balance,
      existing.userId,
      existing.currency,
      dto.notes === undefined ? existing.notes : dto.notes,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
      existing.version,
    );

    return this.accountRepository.update(updated);
  }
}
