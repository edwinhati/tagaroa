import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  haveIBeenPwned,
  multiSession,
  openAPI,
} from "better-auth/plugins";
import { authConfiguration, googleProvider, trustedOrigins } from "./config";
import * as schema from "./db";
import { db } from "./drizzle";

const MAX_SESSIONS_PER_USER = 3;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: !!authConfiguration.cookieDomain,
      domain: authConfiguration.cookieDomain,
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"],
    },
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min — verifies from signed cookie, no DB call
    },
  },
  socialProviders: {
    google: googleProvider,
  },
  rateLimit: authConfiguration.rateLimit,
  plugins: [
    admin(),
    multiSession({ maximumSessions: MAX_SESSIONS_PER_USER }),
    ...(process.env.NODE_ENV === "production"
      ? [haveIBeenPwned()]
      : [openAPI()]),
  ],
  trustedOrigins,
  logger: {
    disabled: false,
    disableColors: false,
    level: process.env.NODE_ENV === "production" ? "error" : "info",
    log: (level, message, ...args) => {
      console.log(
        `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`,
        ...args,
      );
    },
  },
});
