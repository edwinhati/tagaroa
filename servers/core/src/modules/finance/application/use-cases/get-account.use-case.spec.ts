import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { Account } from "../../domain/entities/account.entity";
import {
  AccountAccessDeniedException,
  AccountNotFoundException,
} from "../../domain/exceptions/account.exceptions";
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from "../../domain/repositories/account.repository.interface";
import { AccountCategory } from "../../domain/value-objects/account-category";
import { AccountType } from "../../domain/value-objects/account-type";
import { Currency } from "../../domain/value-objects/currency";
import { GetAccountUseCase } from "./get-account.use-case";

const buildAccount = (id: string, userId: string): Account =>
  new Account(
    id,
    "Checking Account",
    AccountType.BANK,
    AccountCategory.ASSET,
    1000,
    userId,
    Currency.USD,
    null,
    null,
    null,
    new Date(),
    new Date(),
    1,
  );

describe("GetAccountUseCase", () => {
  let useCase: GetAccountUseCase;
  let accountRepository: jest.Mocked<IAccountRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAccountUseCase,
        {
          provide: ACCOUNT_REPOSITORY,
          useValue: {
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByUserId: jest.fn(),
            findByUserIdPaginated: jest.fn(),
            aggregateByType: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetAccountUseCase>(GetAccountUseCase);
    accountRepository = module.get(ACCOUNT_REPOSITORY);
  });

  it("should return the account when found and owned by the user", async () => {
    const account = buildAccount("acc-1", "user-1");
    accountRepository.findById.mockResolvedValue(account);

    const result = await useCase.execute("acc-1", "user-1");
    expect(result).toBe(account);
  });

  it("should throw AccountNotFoundException when account does not exist", async () => {
    accountRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute("nonexistent", "user-1")).rejects.toThrow(
      AccountNotFoundException,
    );
  });

  it("should throw AccountAccessDeniedException when account belongs to another user", async () => {
    const account = buildAccount("acc-1", "other-user");
    accountRepository.findById.mockResolvedValue(account);

    await expect(useCase.execute("acc-1", "user-1")).rejects.toThrow(
      AccountAccessDeniedException,
    );
  });
});
