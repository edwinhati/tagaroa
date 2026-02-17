import type { InferSelectModel } from "drizzle-orm";
import { Account } from "../../../../domain/entities/account.entity";
import type { accounts } from "../schemas/account.schema";

type AccountRow = InferSelectModel<typeof accounts>;

export function mapAccountToDomain(row: AccountRow): Account {
  return new Account(
    row.id,
    row.name,
    row.type,
    Number(row.balance),
    row.userId,
    row.currency,
    row.notes,
    row.deletedAt,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
    row.version ?? 1,
  );
}

export function mapAccountToPersistence(
  entity: Account,
): Omit<AccountRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    balance: String(entity.balance),
    userId: entity.userId,
    currency: entity.currency,
    notes: entity.notes,
    deletedAt: entity.deletedAt,
    version: entity.version,
  };
}

// Legacy class export for backward compatibility
export const AccountMapper = {
  toDomain: mapAccountToDomain,
  toPersistence: mapAccountToPersistence,
};
