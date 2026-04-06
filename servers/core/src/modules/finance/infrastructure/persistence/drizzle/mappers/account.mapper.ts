import type { InferSelectModel } from "drizzle-orm";
import { Account } from "../../../../domain/entities/account.entity";
import type { AccountCategory } from "../../../../domain/value-objects/account-category";
import { getAccountCategoryFromType } from "../../../../domain/value-objects/account-category";
import type { AccountMetadata } from "../../../../domain/value-objects/credit-metadata";
import type { accounts } from "../schemas/account.schema";

type AccountRow = InferSelectModel<typeof accounts>;

function mapAccountToDomain(row: AccountRow): Account {
  // Derive category from stored category or fall back to type-based derivation
  const category: AccountCategory =
    (row.category as AccountCategory) ?? getAccountCategoryFromType(row.type);

  // Parse metadata from JSONB
  const metadata: AccountMetadata | null = row.metadata
    ? (row.metadata as AccountMetadata)
    : null;

  return new Account(
    row.id,
    row.name,
    row.type,
    category,
    Number(row.balance),
    row.userId,
    row.currency,
    row.notes,
    metadata,
    row.deletedAt,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
    row.version ?? 1,
  );
}

function mapAccountToPersistence(
  entity: Account,
): Omit<AccountRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    category: entity.category,
    balance: String(entity.balance),
    userId: entity.userId,
    currency: entity.currency,
    notes: entity.notes,
    metadata: entity.metadata as Record<string, unknown> | null,
    deletedAt: entity.deletedAt,
    version: entity.version,
  };
}

// Legacy class export for backward compatibility
export const AccountMapper = {
  toDomain: mapAccountToDomain,
  toPersistence: mapAccountToPersistence,
};
