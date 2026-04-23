import { describe, expect, it } from "bun:test";
import type { InferSelectModel } from "drizzle-orm";
import { PortfolioSnapshot } from "../../../../domain/entities/portfolio-snapshot.entity";
import type { portfolio } from "../schemas/portfolio.schema";
import { PortfolioSnapshotMapper } from "./portfolio-snapshot.mapper";

type PortfolioSnapshotRow = InferSelectModel<typeof portfolio>;

const createMockRow = (
  overrides: Partial<PortfolioSnapshotRow> = {},
): PortfolioSnapshotRow =>
  ({
    id: "snap-1",
    portfolioId: "portfolio-1",
    userId: "user-1",
    timestamp: "2024-01-15T10:00:00Z",
    nav: "150000",
    cash: "5000",
    positionsSnapshot: {
      "0": {
        instrumentId: "AAPL",
        quantity: 100,
        averageCost: 175,
        side: "LONG",
      },
    },
    createdAt: new Date("2024-01-15T10:00:00Z"),
    version: "1",
    ...overrides,
  }) as PortfolioSnapshotRow;

const createMockEntity = (
  overrides: {
    id?: string;
    portfolioId?: string;
    userId?: string;
    timestamp?: Date;
    nav?: number;
    cash?: number;
    positionsSnapshot?: Record<string, unknown> | null;
    createdAt?: Date;
    version?: number;
  } = {},
): PortfolioSnapshot => {
  const _overrides = overrides as Record<string, unknown>;
  return new PortfolioSnapshot(
    _overrides.id ?? "snap-1",
    _overrides.portfolioId ?? "portfolio-1",
    _overrides.userId ?? "user-1",
    _overrides.timestamp ?? new Date("2024-01-15T10:00:00Z"),
    _overrides.nav ?? 150000,
    _overrides.cash ?? 5000,
    "positionsSnapshot" in _overrides
      ? (_overrides.positionsSnapshot as typeof overrides.positionsSnapshot)
      : {
          "0": {
            instrumentId: "AAPL",
            quantity: 100,
            averageCost: 175,
            side: "LONG",
          },
        },
    _overrides.createdAt ?? new Date("2024-01-15T10:00:00Z"),
    _overrides.version ?? 1,
  );
};

describe("PortfolioSnapshotMapper", () => {
  describe("toDomain", () => {
    it("maps a complete row to correct entity", () => {
      const row = createMockRow();

      const entity = PortfolioSnapshotMapper.toDomain(row);

      expect(entity.id).toBe("snap-1");
      expect(entity.portfolioId).toBe("portfolio-1");
      expect(entity.userId).toBe("user-1");
      expect(entity.timestamp).toEqual(new Date("2024-01-15T10:00:00Z"));
      expect(entity.nav).toBe(150000);
      expect(entity.cash).toBe(5000);
      expect(entity.positionsSnapshot).toEqual({
        "0": {
          instrumentId: "AAPL",
          quantity: 100,
          averageCost: 175,
          side: "LONG",
        },
      });
      expect(entity.createdAt).toEqual(new Date("2024-01-15T10:00:00Z"));
      expect(entity.version).toBe(1);
    });

    it("parses timestamp string to Date", () => {
      const row = createMockRow({ timestamp: "2024-06-20T15:30:00Z" });

      const entity = PortfolioSnapshotMapper.toDomain(row);

      expect(entity.timestamp).toEqual(new Date("2024-06-20T15:30:00Z"));
    });

    it("converts nav and cash from string to number", () => {
      const row = createMockRow({ nav: "250000.75", cash: "12500.50" });

      const entity = PortfolioSnapshotMapper.toDomain(row);

      expect(entity.nav).toBe(250000.75);
      expect(entity.cash).toBe(12500.5);
    });

    it("converts version from string to number", () => {
      const row = createMockRow({ version: "5" });

      const entity = PortfolioSnapshotMapper.toDomain(row);

      expect(entity.version).toBe(5);
    });

    it("handles null positionsSnapshot", () => {
      const row = createMockRow({ positionsSnapshot: null });

      const entity = PortfolioSnapshotMapper.toDomain(row);

      expect(entity.positionsSnapshot).toBeNull();
    });
  });

  describe("toPersistence", () => {
    it("maps a complete entity to correct persistence shape", () => {
      const entity = createMockEntity();

      const persistence = PortfolioSnapshotMapper.toPersistence(entity);

      expect(persistence.id).toBe("snap-1");
      expect(persistence.portfolioId).toBe("portfolio-1");
      expect(persistence.userId).toBe("user-1");
      expect(persistence.timestamp).toEqual(new Date("2024-01-15T10:00:00Z"));
      expect(persistence.nav).toBe("150000");
      expect(persistence.cash).toBe("5000");
      expect(persistence.positionsSnapshot).toEqual({
        "0": {
          instrumentId: "AAPL",
          quantity: 100,
          averageCost: 175,
          side: "LONG",
        },
      });
      expect(persistence.version).toBe("1");
    });

    it("converts nav and cash numbers to strings", () => {
      const entity = createMockEntity({ nav: 200000, cash: 8000 });

      const persistence = PortfolioSnapshotMapper.toPersistence(entity);

      expect(persistence.nav).toBe("200000");
      expect(persistence.cash).toBe("8000");
    });

    it("converts version number to string", () => {
      const entity = createMockEntity({ version: 10 });

      const persistence = PortfolioSnapshotMapper.toPersistence(entity);

      expect(persistence.version).toBe("10");
    });

    it("keeps timestamp as Date object", () => {
      const entity = createMockEntity({
        timestamp: new Date("2024-12-25T12:00:00Z"),
      });

      const persistence = PortfolioSnapshotMapper.toPersistence(entity);

      expect(persistence.timestamp).toEqual(new Date("2024-12-25T12:00:00Z"));
    });

    it("omits createdAt from output", () => {
      const entity = createMockEntity();

      const persistence = PortfolioSnapshotMapper.toPersistence(entity);

      expect("createdAt" in persistence).toBe(false);
    });

    it("preserves null positionsSnapshot in output", () => {
      const entity = createMockEntity({ positionsSnapshot: null });

      const persistence = PortfolioSnapshotMapper.toPersistence(entity);

      expect(persistence.positionsSnapshot).toBeNull();
    });
  });
});
