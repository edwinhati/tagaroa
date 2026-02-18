import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { Account } from "../../domain/entities/account.entity";
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from "../../domain/repositories/account.repository.interface";
import { AccountType } from "../../domain/value-objects/account-type";
import { Currency } from "../../domain/value-objects/currency";
import { CreateAccountUseCase } from "./create-account.use-case";

const mockAccount = new Account(
  "account-id-1",
  "Checking Account",
  AccountType.BANK,
  1000,
  "user-id-1",
  Currency.USD,
  null,
  null,
  new Date(),
  new Date(),
  1,
);

describe("CreateAccountUseCase", () => {
  let useCase: CreateAccountUseCase;
  let accountRepository: jest.Mocked<IAccountRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAccountUseCase,
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

    useCase = module.get<CreateAccountUseCase>(CreateAccountUseCase);
    accountRepository = module.get(ACCOUNT_REPOSITORY);
  });

  it("should create an account and return it", async () => {
    accountRepository.create.mockResolvedValue(mockAccount);

    const result = await useCase.execute(
      {
        name: "Checking Account",
        type: AccountType.BANK,
        balance: 1000,
        currency: Currency.USD,
      },
      "user-id-1",
    );

    expect(result).toBe(mockAccount);
    expect(result.userId).toBe("user-id-1");
    expect(accountRepository.create).toHaveBeenCalledTimes(1);
  });

  it("should pass userId from the caller to the repository", async () => {
    const userId = "user-abc-123";
    accountRepository.create.mockResolvedValue({
      ...mockAccount,
      userId,
    } as Account);

    await useCase.execute(
      { name: "Savings", type: AccountType.BANK, currency: Currency.USD },
      userId,
    );

    const createdAccount = accountRepository.create.mock.calls[0]?.[0];
    expect(createdAccount?.userId).toBe(userId);
  });

  it("should use 0 as default balance when not provided", async () => {
    accountRepository.create.mockResolvedValue(mockAccount);

    await useCase.execute(
      { name: "New Account", type: AccountType.CASH, currency: Currency.USD },
      "user-id-1",
    );

    const createdAccount = accountRepository.create.mock.calls[0]?.[0];
    expect(createdAccount?.balance).toBe(0);
  });
});
