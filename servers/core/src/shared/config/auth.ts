import { CONSTANTS } from "../constants/auth";

type UserInfoClaimSource = {
  name?: string | null;
  image?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
};

type ClientMetadata = {
  internal?: boolean;
};

type AuthClient = {
  metadata?: ClientMetadata | null;
};

export const getBaseUrl = (): string => {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    return "http://localhost:8080";
  }
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl;
  }
};

export const getCookieDomain = (): string | undefined => {
  try {
    return process.env.BASE_URL
      ? new URL(process.env.BASE_URL).hostname
      : undefined;
  } catch {
    return process.env.BASE_URL;
  }
};

export const authConfiguration = {
  getAdditionalUserInfoClaim: (
    user: UserInfoClaimSource,
    scopes: string[],
    client: AuthClient,
  ): Record<string, unknown> => {
    const claims: Record<string, unknown> = {};

    if (scopes.includes("profile")) {
      claims.name = user.name;
      claims.picture = user.image;
      claims.given_name = user.name?.split(" ")[0];
      claims.family_name = user.name?.split(" ").slice(1).join(" ");
    }

    if (scopes.includes("email")) {
      claims.email = user.email;
      claims.email_verified = user.emailVerified;
    }

    if (client.metadata?.internal) {
      claims.internal_user = true;
      claims.roles = ["user"];
    }

    return claims;
  },

  rateLimit: {
    enabled: true,
    window: CONSTANTS.RATE_LIMITS.DEFAULT_WINDOW_SECONDS,
    max: CONSTANTS.RATE_LIMITS.DEFAULT_MAX_REQUESTS,
    storage:
      process.env.NODE_ENV === "production"
        ? ("database" as const)
        : ("memory" as const),
    customRules: {
      "/sign-in/email": {
        window: CONSTANTS.RATE_LIMITS.SIGN_IN_WINDOW_SECONDS,
        max: CONSTANTS.RATE_LIMITS.SIGN_IN_MAX_ATTEMPTS,
      },
      "/sign-up/email": {
        window: CONSTANTS.RATE_LIMITS.SIGN_UP_WINDOW_SECONDS,
        max: CONSTANTS.RATE_LIMITS.SIGN_UP_MAX_ATTEMPTS,
      },
      "/reset-password": {
        window: CONSTANTS.RATE_LIMITS.RESET_PASSWORD_WINDOW_SECONDS,
        max: CONSTANTS.RATE_LIMITS.RESET_PASSWORD_MAX_ATTEMPTS,
      },
      "/verify-email": {
        window: CONSTANTS.RATE_LIMITS.VERIFY_EMAIL_WINDOW_SECONDS,
        max: CONSTANTS.RATE_LIMITS.VERIFY_EMAIL_MAX_ATTEMPTS,
      },
      "/oauth2/authorize": {
        window: CONSTANTS.RATE_LIMITS.OAUTH_AUTHORIZE_WINDOW_SECONDS,
        max: CONSTANTS.RATE_LIMITS.OAUTH_AUTHORIZE_MAX_ATTEMPTS,
      },
      "/oauth2/token": {
        window: CONSTANTS.RATE_LIMITS.OAUTH_TOKEN_WINDOW_SECONDS,
        max: CONSTANTS.RATE_LIMITS.OAUTH_TOKEN_MAX_ATTEMPTS,
      },
      "/oauth2/userinfo": {
        window: CONSTANTS.RATE_LIMITS.OAUTH_USERINFO_WINDOW_SECONDS,
        max: CONSTANTS.RATE_LIMITS.OAUTH_USERINFO_MAX_ATTEMPTS,
      },
    },
  },

  cookieDomain: getCookieDomain(),
};

export const trustedOrigins: string[] = process.env.TRUSTED_ORIGINS
  ? process.env.TRUSTED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

export const googleProvider = {
  clientId: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
};
