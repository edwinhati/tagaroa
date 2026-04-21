import { dash, sentinel } from "@better-auth/infra";
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
import { secondaryStorage } from "./redis";

const MAX_SESSIONS_PER_USER = 3;

export const auth = betterAuth({
  appName: "Tagaroa",
  baseURL: process.env.BASE_URL,
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
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60,
    cookieCache: {
      enabled: true,
      strategy: "jwe",
      maxAge: 5 * 60,
    },
    storeSessionInDatabase: true,
  },
  socialProviders: {
    google: googleProvider,
  },
  rateLimit: authConfiguration.rateLimit,
  plugins: [
    admin(),
    multiSession({ maximumSessions: MAX_SESSIONS_PER_USER }),
    dash({
      apiKey: process.env.BETTER_AUTH_API_KEY,
    }),
    ...(process.env.BETTER_AUTH_API_KEY
      ? [
          sentinel({
            apiKey: process.env.BETTER_AUTH_API_KEY,
          }),
        ]
      : []),
    ...(process.env.NODE_ENV === "production"
      ? [haveIBeenPwned()]
      : [openAPI({ disableDefaultReference: true })]),
  ],
  trustedOrigins,
  secondaryStorage,
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
  experimental: {
    joins: true,
  },
});
