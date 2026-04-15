import { Inject, Injectable } from "@nestjs/common";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../shared/database/database.constants";
import { TransactionalContext } from "../../../../shared/database/transactional-context";

@Injectable()
export class UnitOfWork {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: BunSQLDatabase,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return TransactionalContext.run(tx, fn);
    });
  }
}
