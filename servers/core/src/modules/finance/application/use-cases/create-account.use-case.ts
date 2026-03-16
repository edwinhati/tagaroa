import { Inject, Injectable } from "@nestjs/common";
import { Account } from "../../domain/entities/account.entity";
import type { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";
import { getAccountCategoryFromType } from "../../domain/value-objects/account-category";
import type { AccountMetadata } from "../../domain/value-objects/credit-metadata";
import { calculateAvailableCredit } from "../../domain/value-objects/credit-metadata";
import type { CreateAccountDto } from "../dtos/create-account.dto";

@Injectable()
export class CreateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(dto: CreateAccountDto, userId: string): Promise<Account> {
    const now = new Date();

    // Derive category from account type
    const category = getAccountCategoryFromType(dto.type);

    // Process metadata - convert string dates to Date objects
    let metadata: AccountMetadata | null = null;
    if (dto.metadata) {
      metadata = { ...dto.metadata } as AccountMetadata;

      // Convert nextDueDate string to Date if present
      if (
        "nextDueDate" in dto.metadata &&
        typeof dto.metadata.nextDueDate === "string"
      ) {
        metadata = {
          ...metadata,
          nextDueDate: new Date(dto.metadata.nextDueDate),
        };
      }

      // Calculate available credit for liability accounts
      if (category === "LIABILITY") {
        const meta = dto.metadata as { creditLimit?: number };
        const creditLimit = meta.creditLimit;
        const balance = dto.balance ?? 0;
        if (creditLimit !== undefined && creditLimit > 0) {
          metadata = {
            ...metadata,
            availableCredit: calculateAvailableCredit(creditLimit, balance),
          };
        }
      }
    }

    const account = new Account(
      crypto.randomUUID(),
      dto.name,
      dto.type,
      category,
      dto.balance ?? 0,
      userId,
      dto.currency,
      dto.notes ?? null,
      metadata,
      null,
      now,
      now,
      1,
    );

    return this.accountRepository.create(account);
  }
}
