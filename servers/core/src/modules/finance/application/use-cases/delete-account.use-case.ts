import { Inject, Injectable } from "@nestjs/common";
import {
  AccountAccessDeniedException,
  AccountNotFoundException,
} from "../../domain/exceptions/account.exceptions";
import type { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";

@Injectable()
export class DeleteAccountUseCase {
  @Inject(ACCOUNT_REPOSITORY)
  private readonly accountRepository!: IAccountRepository;

  async execute(id: string, userId: string): Promise<void> {
    const account = await this.accountRepository.findById(id);

    if (!account) {
      throw new AccountNotFoundException(id);
    }

    if (account.userId !== userId) {
      throw new AccountAccessDeniedException();
    }

    await this.accountRepository.delete(id);
  }
}
