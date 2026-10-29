import { describe, expect, it, test } from "bun:test";

import {
  fetchSession,
  fetchDomainMemberships,
  isAdmitted,
  isDomainAdmin,
  isImpersonating,
  signInUrl,
} from "./session";

describe("signInUrl", () => {
  it("carries the way back, encoded", () => {
    const url = signInUrl(
      "http://localhost:3000/finance?tab=ledger",
      "http://localhost:3001",
    );
    expect(url).toBe(
      "http://localhost:3001/?redirect=http%3A%2F%2Flocalhost%3A3000%2Ffinance%3Ftab%3Dledger",
    );
    expect(new URL(url).searchParams.get("redirect")).toBe(
      "http://localhost:3000/finance?tab=ledger",
    );
  });

  it("keeps a path on the door and replaces an existing redirect", () => {
    const url = signInUrl(
      "http://localhost:3000/",
      "http://localhost:3001/sign-in?redirect=http://elsewhere",
    );
    expect(new URL(url).pathname).toBe("/sign-in");
    expect(new URL(url).searchParams.get("redirect")).toBe(
      "http://localhost:3000/",
    );
  });
});

describe("isAdmitted", () => {
  it("refuses no session, and a session still on a temporary password", () => {
    expect(isAdmitted(null)).toBe(false);
    expect(isAdmitted({})).toBe(false);
    expect(isAdmitted({ user: { mustChangePassword: true } })).toBe(false);
    expect(isAdmitted({ user: { email: "e@tagaroa.com" } })).toBe(true);
    expect(isAdmitted({ user: { role: "admin" } })).toBe(false);
    expect(
      isAdmitted({ user: { role: "admin", twoFactorEnabled: true } }),
    ).toBe(true);
  });
});

describe("fetchSession", () => {
  it("reads no session out of an unreachable service", async () => {
    expect(
      await fetchSession(() => Promise.reject(new Error("ECONNREFUSED"))),
    ).toBe(null);
  });
});

describe("isImpersonating", () => {
  it("recognizes only a session issued by an operator", () => {
    expect(isImpersonating(null)).toBe(false);
    expect(isImpersonating({ session: {}, user: {} })).toBe(false);
    expect(
      isImpersonating({
        session: { impersonatedBy: "operator-id" },
        user: { id: "person-id" },
      }),
    ).toBe(true);
  });
});

describe("isDomainAdmin", () => {
  const ana = { user: { email: "ana@tagaroa.com", role: "user" } };
  const admin = {
    user: {
      email: "root@tagaroa.com",
      role: "admin",
      twoFactorEnabled: true,
    },
  };

  it("does not turn an identity role into business access", () => {
    expect(isDomainAdmin(admin, "engineering")).toBe(false);
    expect(isDomainAdmin(admin, "finance")).toBe(false);
    expect(
      isDomainAdmin(
        { user: { role: "super-admin", twoFactorEnabled: true } },
        "supply-chain",
        ["supply-chain"],
      ),
    ).toBe(true);
  });

  it("passes a domain admin only for the domain they administer", () => {
    expect(isDomainAdmin(ana, "engineering", ["engineering"])).toBe(true);
    expect(isDomainAdmin(ana, "finance", ["engineering"])).toBe(false);
  });

  it("accepts stable domain slugs and ignores unmapped names", () => {
    expect(isDomainAdmin(ana, "supply-chain", ["supply-chain"])).toBe(true);
    expect(isDomainAdmin(ana, "engineering", ["Night shift"])).toBe(false);
  });

  it("refuses everyone with no session, whatever adminships are argued in", () => {
    expect(isDomainAdmin(null, "engineering")).toBe(false);
    expect(isDomainAdmin(null, "engineering", ["engineering"])).toBe(false);
  });

  it("refuses a session still on a temporary password", () => {
    expect(
      isDomainAdmin(
        { user: { role: "admin", mustChangePassword: true } },
        "engineering",
      ),
    ).toBe(false);
  });
});

test("domain membership reads fail closed and reject malformed responses", async () => {
  for (const response of [
    new Response("unavailable", { status: 503 }),
    Response.json({ data: [{ domainSlug: "engineering" }] }),
    Response.json({ data: "engineering" }),
  ]) {
    expect(await fetchDomainMemberships(async () => response)).toEqual([]);
  }
  const membership = {
    teamId: "immutable-team-id",
    organizationId: "subsidiary",
    domainSlug: "engineering",
    administered: false,
  };
  expect(
    await fetchDomainMemberships(async () =>
      Response.json({ data: [membership] }),
    ),
  ).toEqual([membership]);
});
