import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  authConfiguration,
  getBaseUrl,
  getCookieDomain,
  trustedOrigins,
} from "./configuration";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("getBaseUrl", () => {
  test("returns localhost default when BASE_URL is not set", () => {
    delete process.env.BASE_URL;
    expect(getBaseUrl()).toBe("http://localhost:8080");
  });

  test("returns origin when BASE_URL is a valid URL", () => {
    process.env.BASE_URL = "https://example.com:8080/path";
    expect(getBaseUrl()).toBe("https://example.com:8080");
  });

  test("returns origin without port for standard HTTP", () => {
    process.env.BASE_URL = "http://example.com/path";
    expect(getBaseUrl()).toBe("http://example.com");
  });

  test("returns origin without port for standard HTTPS", () => {
    process.env.BASE_URL = "https://example.com/path";
    expect(getBaseUrl()).toBe("https://example.com");
  });

  test("returns BASE_URL as-is when invalid URL", () => {
    process.env.BASE_URL = "not-a-valid-url";
    expect(getBaseUrl()).toBe("not-a-valid-url");
  });

  test("handles empty string BASE_URL", () => {
    process.env.BASE_URL = "";
    expect(getBaseUrl()).toBe("http://localhost:8080");
  });
});

describe("getCookieDomain", () => {
  test("returns undefined when BASE_URL is not set", () => {
    delete process.env.BASE_URL;
    expect(getCookieDomain()).toBeUndefined();
  });

  test("returns hostname when BASE_URL is a valid URL", () => {
    process.env.BASE_URL = "https://example.com:8080/path";
    expect(getCookieDomain()).toBe("example.com");
  });

  test("returns hostname for localhost", () => {
    process.env.BASE_URL = "http://localhost:3000";
    expect(getCookieDomain()).toBe("localhost");
  });

  test("returns hostname for IP address", () => {
    process.env.BASE_URL = "http://127.0.0.1:8080";
    expect(getCookieDomain()).toBe("127.0.0.1");
  });

  test("returns BASE_URL as-is when invalid URL", () => {
    process.env.BASE_URL = "invalid-url";
    expect(getCookieDomain()).toBe("invalid-url");
  });

  test("handles empty string BASE_URL", () => {
    process.env.BASE_URL = "";
    expect(getCookieDomain()).toBeUndefined();
  });
});

describe("authConfiguration.getAdditionalUserInfoClaim", () => {
  const user = {
    name: "John Doe",
    image: "https://example.com/avatar.jpg",
    email: "john@example.com",
    emailVerified: true,
  };

  test("includes profile scope claims when profile scope is present", () => {
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      user,
      ["profile"],
      {
        metadata: null,
      },
    );
    expect(claims.name).toBe("John Doe");
    expect(claims.picture).toBe("https://example.com/avatar.jpg");
    expect(claims.given_name).toBe("John");
    expect(claims.family_name).toBe("Doe");
  });

  test("includes email scope claims when email scope is present", () => {
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      user,
      ["email"],
      {
        metadata: null,
      },
    );
    expect(claims.email).toBe("john@example.com");
    expect(claims.email_verified).toBe(true);
  });

  test("includes both profile and email claims when both scopes are present", () => {
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      user,
      ["profile", "email"],
      {
        metadata: null,
      },
    );
    expect(claims.name).toBe("John Doe");
    expect(claims.picture).toBe("https://example.com/avatar.jpg");
    expect(claims.given_name).toBe("John");
    expect(claims.family_name).toBe("Doe");
    expect(claims.email).toBe("john@example.com");
    expect(claims.email_verified).toBe(true);
  });

  test("includes internal client claims when client has internal metadata", () => {
    const claims = authConfiguration.getAdditionalUserInfoClaim(user, [], {
      metadata: { internal: true },
    });
    expect(claims.internal_user).toBe(true);
    expect(claims.roles).toEqual(["user"]);
  });

  test("does not include internal claims when client is not internal", () => {
    const claims = authConfiguration.getAdditionalUserInfoClaim(user, [], {
      metadata: { internal: false },
    });
    expect(claims.internal_user).toBeUndefined();
    expect(claims.roles).toBeUndefined();
  });

  test("handles null client metadata", () => {
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      user,
      ["profile"],
      {
        metadata: null,
      },
    );
    expect(claims.name).toBe("John Doe");
  });

  test("handles missing client metadata", () => {
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      user,
      ["profile"],
      {},
    );
    expect(claims.name).toBe("John Doe");
  });

  test("handles user with null values", () => {
    const nullUser = {
      name: null,
      image: null,
      email: null,
      emailVerified: null,
    };
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      nullUser,
      ["profile", "email"],
      {
        metadata: null,
      },
    );
    expect(claims.name).toBeNull();
    expect(claims.picture).toBeNull();
    expect(claims.given_name).toBeUndefined();
    expect(claims.family_name).toBeUndefined();
    expect(claims.email).toBeNull();
    expect(claims.email_verified).toBeNull();
  });

  test("handles single name for given_name and family_name", () => {
    const singleNameUser = { ...user, name: "Madonna" };
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      singleNameUser,
      ["profile"],
      {
        metadata: null,
      },
    );
    expect(claims.given_name).toBe("Madonna");
    expect(claims.family_name).toBe("");
  });

  test("handles multi-part name for family_name", () => {
    const multiPartNameUser = {
      ...user,
      name: "John Jacob Jingleheimer Schmidt",
    };
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      multiPartNameUser,
      ["profile"],
      {
        metadata: null,
      },
    );
    expect(claims.given_name).toBe("John");
    expect(claims.family_name).toBe("Jacob Jingleheimer Schmidt");
  });

  test("returns empty object when no scopes match", () => {
    const claims = authConfiguration.getAdditionalUserInfoClaim(
      user,
      ["openid"],
      {
        metadata: null,
      },
    );
    expect(Object.keys(claims)).toHaveLength(0);
  });
});

describe("trustedOrigins", () => {
  test("parses TRUSTED_ORIGINS with comma-separated values", () => {
    process.env.TRUSTED_ORIGINS = "https://example.com,https://app.example.com";
    // Re-import to get updated value
    delete require.cache[require.resolve("./configuration")];
    const { trustedOrigins: origins } = require("./configuration");
    expect(origins).toEqual(["https://example.com", "https://app.example.com"]);
  });

  test("trims whitespace from origins", () => {
    process.env.TRUSTED_ORIGINS =
      " https://example.com , https://app.example.com ";
    delete require.cache[require.resolve("./configuration")];
    const { trustedOrigins: origins } = require("./configuration");
    expect(origins).toEqual(["https://example.com", "https://app.example.com"]);
  });

  test("filters out empty values", () => {
    process.env.TRUSTED_ORIGINS =
      "https://example.com,,https://app.example.com,";
    delete require.cache[require.resolve("./configuration")];
    const { trustedOrigins: origins } = require("./configuration");
    expect(origins).toEqual(["https://example.com", "https://app.example.com"]);
  });

  test("returns empty array when TRUSTED_ORIGINS is not set", () => {
    delete process.env.TRUSTED_ORIGINS;
    delete require.cache[require.resolve("./configuration")];
    const { trustedOrigins: origins } = require("./configuration");
    expect(origins).toEqual([]);
  });

  test("handles empty string TRUSTED_ORIGINS", () => {
    process.env.TRUSTED_ORIGINS = "";
    delete require.cache[require.resolve("./configuration")];
    const { trustedOrigins: origins } = require("./configuration");
    expect(origins).toEqual([]);
  });
});
