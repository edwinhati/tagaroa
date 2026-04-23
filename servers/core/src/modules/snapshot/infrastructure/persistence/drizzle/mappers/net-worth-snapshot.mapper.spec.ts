import { describe, expect, it } from "bun:test";
import type { InferSelectModel } from "drizzle-orm";
import {
  type AssetsBreakdown,
  type FxRatesUsed,
  type LiabilitiesBreakdown,
  NetWorthSnapshot,
} from "../../../../domain/entities/net-worth-snapshot.entity";
import type { netWorth } from "../schemas/net-worth.schema";
import { NetWorthSnapshotMapper } from "./net-worth-snapshot.mapper";

type NetWorthSnapshotRow = InferSelectModel<typeof netWorth>;

const createMockRow = (
  overrides: Partial<NetWorthSnapshotRow> = {},
): NetWorthSnapshotRow =>
  ({
    id: "snap-1",
    userId: "user-1",
    snapshotDate: "2024-01-15",
    totalAssets: "100000",
    totalLiabilities: "20000",
    netWorth: "80000",
    baseCurrency: "USD",
    assetsBreakdown: {
      liquidity: 10000,
      investments: 60000,
      fixedAssets: 30000,
    },
    liabilitiesBreakdown: { revolving: 5000, termLoans: 15000 },
    fxRatesUsed: { EUR: 0.92 },
    fxRateDate: "2024-01-15",
    fxRateSource: "ECB",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    version: 1,
    ...overrides,
  }) as NetWorthSnapshotRow;

const createMockEntity = (
  overrides: {
    id?: string;
    userId?: string;
    snapshotDate?: Date;
    totalAssets?: number;
    totalLiabilities?: number;
    netWorth?: number;
    baseCurrency?: string;
    assetsBreakdown?: AssetsBreakdown;
    liabilitiesBreakdown?: LiabilitiesBreakdown;
    fxRatesUsed?: FxRatesUsed;
    fxRateDate?: Date;
    fxRateSource?: string | null;
    createdAt?: Date;
    version?: number;
  } = {},
): NetWorthSnapshot =>
  new NetWorthSnapshot(
    overrides.id ?? "snap-1",
    overrides.userId ?? "user-1",
    overrides.snapshotDate ?? new Date("2024-01-15"),
    overrides.totalAssets ?? 100000,
    overrides.totalLiabilities ?? 20000,
    overrides.netWorth ?? 80000,
    overrides.baseCurrency ?? "USD",
    overrides.assetsBreakdown ?? {
      liquidity: 10000,
      investments: 60000,
      fixedAssets: 30000,
    },
    overrides.liabilitiesBreakdown ?? { revolving: 5000, termLoans: 15000 },
    overrides.fxRatesUsed ?? { EUR: 0.92 },
    overrides.fxRateDate ?? new Date("2024-01-15"),
    overrides.fxRateSource ?? "ECB",
    overrides.createdAt ?? new Date("2024-01-15T10:00:00Z"),
    overrides.version ?? 1,
  );

describe("NetWorthSnapshotMapper", () => {
  describe("toDomain", () => {
    it("maps a complete row with all fields to correct entity", () => {
      const row = createMockRow();

      const entity = NetWorthSnapshotMapper.toDomain(row);

      expect(entity.id).toBe("snap-1");
      expect(entity.userId).toBe("user-1");
      expect(entity.snapshotDate).toEqual(new Date("2024-01-15"));
      expect(entity.totalAssets).toBe(100000);
      expect(entity.totalLiabilities).toBe(20000);
      expect(entity.netWorth).toBe(80000);
      expect(entity.baseCurrency).toBe("USD");
      expect(entity.assetsBreakdown).toEqual({
        liquidity: 10000,
        investments: 60000,
        fixedAssets: 30000,
      });
      expect(entity.liabilitiesBreakdown).toEqual({
        revolving: 5000,
        termLoans: 15000,
      });
      expect(entity.fxRatesUsed).toEqual({ EUR: 0.92 });
      expect(entity.fxRateDate).toEqual(new Date("2024-01-15"));
      expect(entity.fxRateSource).toBe("ECB");
      expect(entity.createdAt).toEqual(new Date("2024-01-15T10:00:00Z"));
      expect(entity.version).toBe(1);
    });

    it("handles null fxRateSource", () => {
      const row = createMockRow({ fxRateSource: null });

      const entity = NetWorthSnapshotMapper.toDomain(row);

      expect(entity.fxRateSource).toBeNull();
    });

    it("parses snapshotDate string to Date", () => {
      const row = createMockRow({ snapshotDate: "2024-06-20" });

      const entity = NetWorthSnapshotMapper.toDomain(row);

      expect(entity.snapshotDate).toEqual(new Date("2024-06-20"));
    });

    it("converts totalAssets, totalLiabilities, netWorth from string to number", () => {
      const row = createMockRow({
        totalAssets: "250000.50",
        totalLiabilities: "75000.25",
        netWorth: "175000.25",
      });

      const entity = NetWorthSnapshotMapper.toDomain(row);

      expect(entity.totalAssets).toBe(250000.5);
      expect(entity.totalLiabilities).toBe(75000.25);
      expect(entity.netWorth).toBe(175000.25);
    });
  });

  describe("toPersistence", () => {
    it("maps a complete entity to correct persistence shape", () => {
      const entity = createMockEntity();

      const persistence = NetWorthSnapshotMapper.toPersistence(entity);

      expect(persistence.id).toBe("snap-1");
      expect(persistence.userId).toBe("user-1");
      expect(persistence.snapshotDate).toBe("2024-01-15");
      expect(persistence.totalAssets).toBe("100000");
      expect(persistence.totalLiabilities).toBe("20000");
      expect(persistence.netWorth).toBe("80000");
      expect(persistence.baseCurrency).toBe("USD");
      expect(persistence.assetsBreakdown).toEqual({
        liquidity: 10000,
        investments: 60000,
        fixedAssets: 30000,
      });
      expect(persistence.liabilitiesBreakdown).toEqual({
        revolving: 5000,
        termLoans: 15000,
      });
      expect(persistence.fxRatesUsed).toEqual({ EUR: 0.92 });
      expect(persistence.fxRateDate).toBe("2024-01-15");
      expect(persistence.fxRateSource).toBe("ECB");
      expect(persistence.version).toBe(1);
    });

    it("converts snapshotDate Date to YYYY-MM-DD string", () => {
      const entity = createMockEntity({ snapshotDate: new Date("2024-12-25") });

      const persistence = NetWorthSnapshotMapper.toPersistence(entity);

      expect(persistence.snapshotDate).toBe("2024-12-25");
    });

    it("converts fxRateDate Date to YYYY-MM-DD string", () => {
      const entity = createMockEntity({ fxRateDate: new Date("2024-12-25") });

      const persistence = NetWorthSnapshotMapper.toPersistence(entity);

      expect(persistence.fxRateDate).toBe("2024-12-25");
    });

    it("converts numbers to strings for totalAssets, totalLiabilities, netWorth", () => {
      const entity = createMockEntity({
        totalAssets: 500000,
        totalLiabilities: 150000,
        netWorth: 350000,
      });

      const persistence = NetWorthSnapshotMapper.toPersistence(entity);

      expect(persistence.totalAssets).toBe("500000");
      expect(persistence.totalLiabilities).toBe("150000");
      expect(persistence.netWorth).toBe("350000");
    });

    it("omits createdAt from output", () => {
      const entity = createMockEntity();

      const persistence = NetWorthSnapshotMapper.toPersistence(entity);

      expect("createdAt" in persistence).toBe(false);
    });
  });
});
