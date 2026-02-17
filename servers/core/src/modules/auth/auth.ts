import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  haveIBeenPwned,
  multiSession,
  openAPI,
} from "better-auth/plugins";
import { db } from "../../shared/client/drizzle";
import {
  authConfiguration,
  googleProvider,
  trustedOrigins,
} from "../../shared/config/auth";
import { CONSTANTS } from "../../shared/constants/auth";
import * as schema from "./infrastructure/persistence/drizzle";

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
  socialProviders: {
    google: googleProvider,
  },
  rateLimit: authConfiguration.rateLimit,
  plugins: [
    admin(),
    multiSession({ maximumSessions: CONSTANTS.SESSIONS.MAX_PER_USER }),
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
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] [${level.toUpperCase()}] ${message}`,
        ...args,
      );
    },
  },
});
