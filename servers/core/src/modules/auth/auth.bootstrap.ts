import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { validateEnv } from "../../platform/config/env";
import * as schema from "../../schema.registry";
import { createAuth } from "./auth";
import { createAuthRepository } from "./infrastructure/persistence/auth.persistence.module";

const env = validateEnv(Bun.env);
const client = new SQL(env.DATABASE_URL);

export const auth = createAuth(
  createAuthRepository(drizzle({ client, schema })),
  {
    baseURL: env.BETTER_AUTH_URL,
    nodeEnv: env.NODE_ENV,
    passkeyOrigins: env.PASSKEY_ORIGINS,
    passkeyRpId: env.PASSKEY_RP_ID,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.TRUSTED_ORIGINS,
    trustedProxies: env.AUTH_TRUSTED_PROXIES,
  },
);
