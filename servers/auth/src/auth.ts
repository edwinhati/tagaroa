import { db } from "./db";
import * as schema from "./db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  jwt,
  admin,
  oidcProvider,
  multiSession,
  haveIBeenPwned,
  openAPI,
} from "better-auth/plugins";

export const trustedOrigins = process.env.TRUSTED_ORIGINS
  ? process.env.TRUSTED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    jwt({
      jwt: {
        issuer: `${process.env.BASE_URL}/api/auth`,
        audience: "UhAnFhmKOWHiBINUagjQdMfTMawmXybR",
      },
    }),
    admin(),
    oidcProvider({
      useJWTPlugin: true,
      loginPage: process.env.AUTH_APP_URL as string,
      metadata: {
        issuer: `${process.env.BASE_URL}/api/auth`,
      },
    }),
    multiSession({ maximumSessions: 3 }),
    haveIBeenPwned(),
    ...(process.env.NODE_ENV !== "production" ? [openAPI()] : []),
  ],
  trustedOrigins,
  logger: {
    disabled: false,
    disableColors: false,
    level: "error",
    log: (level, message, ...args) => {
      // Custom logging implementation
      console.log(`[${level}] ${message}`, ...args);
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});
