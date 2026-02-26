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
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage:
      process.env.NODE_ENV === "production"
        ? ("database" as const)
        : ("memory" as const),
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-up/email": { window: 60, max: 5 },
      "/reset-password": { window: 300, max: 3 },
      "/verify-email": { window: 60, max: 5 },
      "/oauth2/authorize": { window: 60, max: 20 },
      "/oauth2/token": { window: 60, max: 30 },
      "/oauth2/userinfo": { window: 60, max: 200 },
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
