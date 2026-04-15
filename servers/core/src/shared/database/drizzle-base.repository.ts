import { Inject, Injectable } from "@nestjs/common";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "./database.constants";
import { TransactionalContext } from "./transactional-context";

@Injectable()
export abstract class DrizzleBaseRepository {
  constructor(
    @Inject(DRIZZLE)
    protected readonly db: BunSQLDatabase,
  ) {}

  protected getDb(): BunSQLDatabase {
    return TransactionalContext.getTx() ?? this.db;
  }
}
