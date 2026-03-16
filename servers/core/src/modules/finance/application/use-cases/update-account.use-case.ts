import { Inject, Injectable } from "@nestjs/common";
import { Account } from "../../domain/entities/account.entity";
import {
  AccountAccessDeniedException,
  AccountNotFoundException,
} from "../../domain/exceptions/account.exceptions";
import type { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";
import type { AccountMetadata } from "../../domain/value-objects/credit-metadata";
import { calculateAvailableCredit } from "../../domain/value-objects/credit-metadata";
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

    // Merge metadata if provided
    let updatedMetadata: AccountMetadata | null = existing.metadata;
    if (dto.metadata !== undefined) {
      if (dto.metadata === null) {
        updatedMetadata = null;
      } else {
        updatedMetadata = {
          ...(existing.metadata ?? {}),
          ...dto.metadata,
        } as AccountMetadata;

        // Convert nextDueDate string to Date if present
        if (
          "nextDueDate" in dto.metadata &&
          typeof dto.metadata.nextDueDate === "string"
        ) {
          updatedMetadata = {
            ...updatedMetadata,
            nextDueDate: new Date(dto.metadata.nextDueDate),
          };
        }

        // Recalculate available credit if credit limit or balance changed
        const newBalance = dto.balance ?? existing.balance;
        if (existing.isLiability()) {
          const meta = dto.metadata as { creditLimit?: number };
          const creditLimit = meta.creditLimit;
          if (creditLimit !== undefined && creditLimit > 0) {
            updatedMetadata = {
              ...updatedMetadata,
              availableCredit: calculateAvailableCredit(
                creditLimit,
                newBalance,
              ),
            };
          }
        }
      }
    }

    const updated = new Account(
      existing.id,
      dto.name ?? existing.name,
      existing.type,
      existing.kind,
      dto.balance ?? existing.balance,
      existing.userId,
      existing.currency,
      dto.notes === undefined ? existing.notes : dto.notes,
      updatedMetadata,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
      existing.version,
    );

    return this.accountRepository.update(updated);
  }
}
