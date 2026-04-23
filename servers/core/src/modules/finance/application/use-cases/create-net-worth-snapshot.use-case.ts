import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  type AssetsBreakdown,
  type FxRatesUsed,
  type LiabilitiesBreakdown,
  NetWorthSnapshot,
} from "../../domain/entities/net-worth-snapshot.entity";
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from "../../domain/repositories/account.repository.interface";
import {
  ASSET_REPOSITORY,
  type IAssetRepository,
} from "../../domain/repositories/asset.repository.interface";
import {
  type ILiabilityRepository,
  LIABILITY_REPOSITORY,
} from "../../domain/repositories/liability.repository.interface";
import { AssetType } from "../../domain/value-objects/asset-type";
import type { Currency } from "../../domain/value-objects/currency";
import { LiabilityType } from "../../domain/value-objects/liability-type";
import type { ExchangeRateService } from "../services/exchange-rate.service";
import { EXCHANGE_RATE_SERVICE } from "../services/exchange-rate.service.token";

export interface CreateNetWorthSnapshotDto {
  userId: string;
  snapshotDate?: Date;
  baseCurrency?: string;
}

@Injectable()
export class CreateNetWorthSnapshotUseCase {
  private readonly logger = new Logger(CreateNetWorthSnapshotUseCase.name);
  private readonly DEFAULT_BASE_CURRENCY = "USD";

  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    @Inject(LIABILITY_REPOSITORY)
    private readonly liabilityRepository: ILiabilityRepository,
    @Inject(EXCHANGE_RATE_SERVICE)
    private readonly exchangeRateService: ExchangeRateService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(dto: CreateNetWorthSnapshotDto): Promise<NetWorthSnapshot> {
    const userId = dto.userId;
    const snapshotDate = dto.snapshotDate ?? new Date();
    const baseCurrency = dto.baseCurrency ?? this.DEFAULT_BASE_CURRENCY;

    this.logger.log(
      `Creating net worth snapshot for user ${userId} on ${snapshotDate.toISOString()}`,
    );

    const [accounts, assets, liabilities] = await Promise.all([
      this.accountRepository.findByUserId(userId),
      this.assetRepository.findByUserId(userId),
      this.liabilityRepository.findByUserId(userId),
    ]);

    const currencies = this.extractUniqueCurrencies(
      accounts,
      assets,
      liabilities,
    );
    currencies.add(baseCurrency);

    const exchangeRates = await this.exchangeRateService.getRatesToUSD(
      Array.from(currencies),
      snapshotDate,
    );

    const assetsBreakdown = this.calculateAssetsBreakdown(
      accounts,
      assets,
      exchangeRates,
    );
    const liabilitiesBreakdown = this.calculateLiabilitiesBreakdown(
      accounts,
      liabilities,
      exchangeRates,
    );

    const totalAssets =
      assetsBreakdown.liquidity +
      assetsBreakdown.investments +
      assetsBreakdown.fixedAssets;
    const totalLiabilities =
      liabilitiesBreakdown.revolving + liabilitiesBreakdown.termLoans;
    const netWorth = totalAssets - totalLiabilities;

    const fxRatesUsed = this.buildFxRatesAuditTrail(exchangeRates);

    const snapshot = new NetWorthSnapshot(
      randomUUID(),
      userId,
      snapshotDate,
      totalAssets,
      totalLiabilities,
      netWorth,
      baseCurrency as Currency,
      assetsBreakdown,
      liabilitiesBreakdown,
      fxRatesUsed,
      snapshotDate,
      "ECB",
      new Date(),
      1,
    );

    this.eventEmitter.emit("snapshot.created", snapshot.toEvent());

    return snapshot;
  }

  private extractUniqueCurrencies(
    accounts: Awaited<ReturnType<IAccountRepository["findByUserId"]>>,
    assets: Awaited<ReturnType<IAssetRepository["findByUserId"]>>,
    liabilities: Awaited<ReturnType<ILiabilityRepository["findByUserId"]>>,
  ): Set<string> {
    const currencies = new Set<string>();

    for (const account of accounts) {
      currencies.add(account.currency);
    }
    for (const asset of assets) {
      currencies.add(asset.currency);
    }
    for (const liability of liabilities) {
      currencies.add(liability.currency);
    }

    return currencies;
  }

  private buildFxRatesAuditTrail(
    exchangeRates: Map<string, { rate: number }>,
  ): FxRatesUsed {
    const fxRatesUsed: FxRatesUsed = {};
    for (const [currency, rateResult] of exchangeRates) {
      fxRatesUsed[currency] = rateResult.rate;
    }
    return fxRatesUsed;
  }

  private calculateAssetsBreakdown(
    accounts: Awaited<ReturnType<IAccountRepository["findByUserId"]>>,
    assets: Awaited<ReturnType<IAssetRepository["findByUserId"]>>,
    exchangeRates: Map<string, { rate: number }>,
  ): AssetsBreakdown {
    const breakdown: AssetsBreakdown = {
      liquidity: 0,
      investments: 0,
      fixedAssets: 0,
    };

    for (const account of accounts) {
      if (account.isAsset() && account.balance > 0) {
        const rate = exchangeRates.get(account.currency)?.rate ?? 1;
        breakdown.liquidity += account.balance * rate;
      }
    }

    for (const asset of assets) {
      if (!asset.isActive()) continue;

      const rate = exchangeRates.get(asset.currency)?.rate ?? 1;
      const valueInBase = asset.value * rate;

      switch (asset.type) {
        case AssetType.CASH:
        case AssetType.SAVINGS:
          breakdown.liquidity += valueInBase;
          break;
        case AssetType.INVESTMENT:
        case AssetType.STOCK:
        case AssetType.CRYPTO:
        case AssetType.BOND:
        case AssetType.MUTUAL_FUND:
          breakdown.investments += valueInBase;
          break;
        case AssetType.REAL_ESTATE:
        case AssetType.VEHICLE:
          breakdown.fixedAssets += valueInBase;
          break;
        default:
          breakdown.investments += valueInBase;
      }
    }

    return {
      liquidity: Math.round(breakdown.liquidity * 100) / 100,
      investments: Math.round(breakdown.investments * 100) / 100,
      fixedAssets: Math.round(breakdown.fixedAssets * 100) / 100,
    };
  }

  private calculateLiabilitiesBreakdown(
    accounts: Awaited<ReturnType<IAccountRepository["findByUserId"]>>,
    liabilities: Awaited<ReturnType<ILiabilityRepository["findByUserId"]>>,
    exchangeRates: Map<string, { rate: number }>,
  ): LiabilitiesBreakdown {
    const breakdown: LiabilitiesBreakdown = {
      revolving: 0,
      termLoans: 0,
    };

    for (const account of accounts) {
      if (account.isLiability() && account.balance > 0) {
        const rate = exchangeRates.get(account.currency)?.rate ?? 1;
        breakdown.revolving += account.balance * rate;
      }
    }

    for (const liability of liabilities) {
      if (liability.deletedAt) continue;

      const rate = exchangeRates.get(liability.currency)?.rate ?? 1;
      const amountInBase = liability.amount * rate;

      switch (liability.type) {
        case LiabilityType.CREDIT_CARD:
          breakdown.revolving += amountInBase;
          break;
        case LiabilityType.LOAN:
        case LiabilityType.MORTGAGE:
        case LiabilityType.AUTO_LOAN:
        case LiabilityType.STUDENT_LOAN:
        case LiabilityType.MEDICAL_DEBT:
        case LiabilityType.TAX_DEBT:
          breakdown.termLoans += amountInBase;
          break;
        default:
          breakdown.termLoans += amountInBase;
      }
    }

    return {
      revolving: Math.round(breakdown.revolving * 100) / 100,
      termLoans: Math.round(breakdown.termLoans * 100) / 100,
    };
  }
}
