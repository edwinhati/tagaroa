import { Inject, Injectable } from "@nestjs/common";
import { Account } from "../../domain/entities/account.entity";
import type { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";
import type { CreateAccountDto } from "../dtos/create-account.dto";

@Injectable()
export class CreateAccountUseCase {
  @Inject(ACCOUNT_REPOSITORY)
  private readonly accountRepository!: IAccountRepository;

  async execute(dto: CreateAccountDto, userId: string): Promise<Account> {
    const now = new Date();
    const account = new Account(
      crypto.randomUUID(),
      dto.name,
      dto.type,
      dto.balance ?? 0,
      userId,
      dto.currency,
      dto.notes ?? null,
      null,
      now,
      now,
      1,
    );

    return this.accountRepository.create(account);
  }
}
