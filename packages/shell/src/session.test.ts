import { describe, expect, it, test, spyOn } from "bun:test";

import { QueryClient } from "@tanstack/react-query";

import {
  admit,
  admitAdmin,
  sessionQueryOptions,
  domainMembershipQueryOptions,
  WORKSPACE_URL,
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

describe("route admission", () => {
  const person = { user: { email: "ana@tagaroa.com", role: "user" } };
  const membership = (domainSlug: string) => ({
    teamId: `team-${domainSlug}`,
    organizationId: "subsidiary",
    domainSlug,
    administered: false,
  });
  const client = (
    session: import("./session").SessionState,
    slugs: string[] = [],
  ) => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryOptions.queryKey, session);
    queryClient.setQueryData(
      domainMembershipQueryOptions.queryKey,
      slugs.map(membership),
    );
    return queryClient;
  };

  it("admits only server-bound domains, deduplicating and ignoring display names", async () => {
    const result = await admit(
      client(person, ["engineering", "engineering", "Finance", "unknown"]),
      "engineering",
    );
    expect(result).toEqual({
      session: person,
      domains: [{ slug: "engineering", label: "Engineering", live: true }],
      admin: false,
    });
  });

  it("allows the workspace with no memberships and preserves coming-soon domains", async () => {
    expect((await admit(client(person))).domains).toEqual([]);
    expect(
      (await admit(client(person, ["finance"]), "finance")).domains,
    ).toEqual([{ slug: "finance", label: "Finance", live: false }]);
  });

  it("refuses domain access even for an identity super-admin without membership", async () => {
    await expect(
      admit(
        client({ user: { role: "super-admin", twoFactorEnabled: true } }),
        "engineering",
      ),
    ).rejects.toMatchObject({ options: { href: WORKSPACE_URL } });
    await expect(
      admit(client(person, ["engineering"]), "finance"),
    ).rejects.toMatchObject({ options: { href: WORKSPACE_URL } });
  });

  it("sends missing, temporary-password and non-MFA privileged sessions to sign-in", async () => {
    const previousWindow = Object.getOwnPropertyDescriptor(
      globalThis,
      "window",
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { href: "http://localhost:3000/engineering?tab=work" },
      },
    });
    try {
      for (const session of [
        null,
        { user: { mustChangePassword: true } },
        { user: { role: "admin" } },
      ]) {
        for (const guard of [
          () => admit(client(session, ["engineering"]), "engineering"),
          () => admitAdmin(client(session)),
        ]) {
          await expect(guard()).rejects.toMatchObject({
            options: { href: signInUrl(window.location.href) },
          });
        }
      }
    } finally {
      if (previousWindow)
        Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("admits each MFA identity role to admin but sends ordinary members to the workspace", async () => {
    await expect(admitAdmin(client(person))).rejects.toMatchObject({
      options: { href: WORKSPACE_URL },
    });
    for (const role of [
      "access-reviewer",
      "helpdesk",
      "admin",
      "super-admin",
      "user, helpdesk",
    ]) {
      const session = { user: { role, twoFactorEnabled: true } };
      expect(await admitAdmin(client(session))).toEqual(session);
      expect((await admit(client(session))).admin).toBe(true);
    }
  });

  it("does not admit when the session or membership query fails", async () => {
    const queryClient = client(person, ["engineering"]);
    const query = spyOn(queryClient, "ensureQueryData").mockRejectedValue(
      new Error("query unavailable"),
    );
    try {
      await expect(admit(queryClient, "engineering")).rejects.toThrow(
        "query unavailable",
      );
    } finally {
      query.mockRestore();
    }
  });
});
