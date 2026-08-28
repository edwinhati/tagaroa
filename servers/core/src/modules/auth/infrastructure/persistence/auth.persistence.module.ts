import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { Module } from "@nestjs/common";

import {
  DATABASE,
  type Database,
} from "../../../../shared/database/database.module";
import * as schema from "./drizzle/schema";

export interface AuthRepository {
  readonly adapter: ReturnType<typeof drizzleAdapter>;
  readonly supportsJoins: boolean;
}

export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

const repository = (
  database: Parameters<typeof drizzleAdapter>[0],
  supportsJoins: boolean,
): AuthRepository => ({
  adapter: drizzleAdapter(database, {
    provider: "pg",
    schema: supportsJoins ? schema : undefined,
    schemaName: "auth",
  }),
  supportsJoins,
});

export const createAuthMetadataRepository = (): AuthRepository =>
  repository({}, false);

export const createAuthRepository = (
  database: Parameters<typeof drizzleAdapter>[0],
): AuthRepository => repository(database, true);

@Module({
  exports: [AUTH_REPOSITORY],
  providers: [
    {
      inject: [DATABASE],
      provide: AUTH_REPOSITORY,
      useFactory: (database: Database) => createAuthRepository(database),
    },
  ],
})
export class AuthPersistenceModule {}
