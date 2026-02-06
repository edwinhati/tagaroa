import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  haveIBeenPwned,
  jwt,
  multiSession,
  oidcProvider,
  openAPI,
} from "better-auth/plugins";
import {
  authConfiguration,
  googleProvider,
  trustedOrigins,
} from "./auth/configuration";
import { db } from "./db";
import * as schema from "./db/schema";

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
    jwt({
      disableSettingJwtHeader: true,
      jwt: {
        issuer: authConfiguration.jwt.issuer,
        audience: authConfiguration.jwt.audience,
        expirationTime: authConfiguration.jwt.expirationTime,
      },
      jwks: {
        keyPairConfig: authConfiguration.jwt.jwks.keyPairConfig,
      },
    }),
    admin(),
    oidcProvider({
      useJWTPlugin: true,
      loginPage: authConfiguration.oidc.loginPage,
      allowDynamicClientRegistration:
        authConfiguration.oidc.allowDynamicClientRegistration,
      metadata: authConfiguration.oidc.metadata,
      getAdditionalUserInfoClaim: authConfiguration.getAdditionalUserInfoClaim,
    }),
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

import { CONSTANTS } from "./lib/constants";
