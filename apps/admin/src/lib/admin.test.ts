import { describe, expect, spyOn, test } from "bun:test";

import { isCancelledError, QueryClient } from "@tanstack/react-query";

import {
  AdminApiError,
  CORE_URL,
  coreMutationDocument,
  listUsersQuery,
  directoryQueryOptions,
  standingOf,
  type PeopleQuery,
  validatePeopleSearch,
} from "./admin";

test("cancelling a paginated directory read aborts the active request", async () => {
  const client = new QueryClient();
  let started!: () => void;
  const secondPage = new Promise<void>((resolve) => {
    started = resolve;
  });
  let signal: AbortSignal | null | undefined;
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (
        _url: Parameters<typeof fetch>[0],
        options?: Parameters<typeof fetch>[1],
      ) => {
        if (fetcher.mock.calls.length === 1) {
          return Response.json({
            data: {
              positions: { data: [], links: {} },
              subsidiaries: { data: [], links: {} },
              teams: {
                data: [],
                links: { next: "/api/directory?teamsPage=2" },
              },
            },
          });
        }
        signal = options?.signal;
        started();
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () =>
              reject(
                new DOMException("Cancelled directory fixture", "AbortError"),
              ),
            { once: true },
          );
        });
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  try {
    const result = client
      .fetchQuery({ ...directoryQueryOptions, retry: false })
      .catch((error: unknown) => error);
    await secondPage;
    await client.cancelQueries({ queryKey: directoryQueryOptions.queryKey });
    expect(isCancelledError(await result)).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally {
    client.clear();
    fetcher.mockRestore();
  }
});

const baseQuery: PeopleQuery = {
  page: 1,
  pageSize: 25,
  role: null,
  search: "",
  slice: "all",
  sort: { direction: "asc", field: "name" },
};

const query = (over: Partial<PeopleQuery> = {}) =>
  listUsersQuery({ ...baseQuery, ...over });

describe("listUsersQuery", () => {
  test("turns a page number into an offset", () => {
    expect(query({ page: 3, pageSize: 10 })).toMatchObject({
      limit: 10,
      offset: 20,
    });
  });

  test("asks for no filter when nothing is chosen", () => {
    expect(query()).not.toHaveProperty("filterField");
    expect(query()).not.toHaveProperty("searchField");
  });

  test("searches the address when the text has an @, the name otherwise", () => {
    expect(query({ search: "jane@tagaroa.com" })).toMatchObject({
      searchField: "email",
      searchOperator: "contains",
      searchValue: "jane@tagaroa.com",
    });
    expect(query({ search: " jane " })).toMatchObject({
      searchField: "name",
      searchValue: "jane",
    });
  });

  test("the suspended slice asks only for banned accounts", () => {
    // Never `false`: an account that has never been suspended is NULL here.
    expect(query({ slice: "suspended" })).toMatchObject({
      filterField: "banned",
      filterOperator: "eq",
      filterValue: true,
    });
  });

  test("the admins slice covers both privileged roles", () => {
    expect(query({ slice: "admins" })).toMatchObject({
      filterField: "role",
      filterOperator: "in",
      filterValue: ["access-reviewer", "helpdesk", "admin", "super-admin"],
    });
  });

  test("a slice keeps the one filter slot, so a role cannot also take it", () => {
    expect(query({ role: "user", slice: "admins" })).toMatchObject({
      filterValue: ["access-reviewer", "helpdesk", "admin", "super-admin"],
    });
    expect(query({ role: "user" })).toMatchObject({
      filterField: "role",
      filterOperator: "eq",
      filterValue: "user",
    });
  });
});

describe("standingOf", () => {
  const person = { banned: null } as Parameters<typeof standingOf>[0];
  const day = 24 * 60 * 60 * 1000;

  test("reads a closed account as suspended", () => {
    expect(standingOf({ ...person, banned: true })).toBe("suspended");
    expect(standingOf(person)).toBe("active");
  });

  test("a lapsed timed ban is open, because Better Auth already lets them in", () => {
    expect(
      standingOf({
        ...person,
        banExpires: new Date(Date.now() - day),
        banned: true,
      }),
    ).toBe("active");
    expect(
      standingOf({
        ...person,
        banExpires: new Date(Date.now() + day),
        banned: true,
      }),
    ).toBe("suspended");
  });
});

describe("validatePeopleSearch", () => {
  test("keeps only shareable directory state", () => {
    expect(
      validatePeopleSearch({
        page: "3",
        q: "  Ana  ",
        role: "helpdesk",
        size: "50",
        slice: "admins",
        sort: "-access",
        unsafe: "ignored",
      }),
    ).toEqual({
      page: 3,
      q: "Ana",
      role: "helpdesk",
      size: 50,
      slice: "admins",
      sort: "-access",
    });
  });

  test("drops invalid pagination, role, slice, and sort values", () => {
    expect(
      validatePeopleSearch({
        page: 0,
        role: "owner",
        size: 500,
        slice: "active",
        sort: "email",
      }),
    ).toEqual({});
  });

  test("degrades a stale multi-role link to its first valid role", () => {
    expect(validatePeopleSearch({ role: ["admin", "helpdesk"] })).toEqual({
      role: "admin",
    });
  });
});

describe("coreMutationDocument", () => {
  /** Answers every fetch with `response` and records what was asked. */
  function stubFetch(response: Response) {
    return spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(async () => response, {
        preconnect: globalThis.fetch.preconnect,
      }),
    );
  }

  test("sends a JSON body and returns the document's data", async () => {
    const fetcher = stubFetch(Response.json({ data: { id: "r1" } }));
    try {
      await expect(
        coreMutationDocument("/api/roles", "POST", { name: "Ops" }, "Failed"),
      ).resolves.toEqual({ id: "r1" });
      const [url, init] = fetcher.mock.calls[0]!;
      expect(url).toBe(`${CORE_URL}/api/roles`);
      expect(init).toMatchObject({
        body: JSON.stringify({ name: "Ops" }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    } finally {
      fetcher.mockRestore();
    }
  });

  test("a bodiless call sends no body and no content type", async () => {
    const fetcher = stubFetch(Response.json({ data: { removed: true } }));
    try {
      await coreMutationDocument(
        "/api/roles/r1",
        "DELETE",
        undefined,
        "Failed",
      );
      const init = fetcher.mock.calls[0]![1]!;
      expect(init).not.toHaveProperty("body");
      expect(init.headers).toBeUndefined();
      expect(init.method).toBe("DELETE");
    } finally {
      fetcher.mockRestore();
    }
  });

  test("a refusal carries the server's message, code, and status", async () => {
    const fetcher = stubFetch(
      Response.json(
        { code: "MFA_REQUIRED", message: "Verify again." },
        { status: 403 },
      ),
    );
    try {
      const error = await coreMutationDocument(
        "/api/roles",
        "POST",
        {},
        "Failed",
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AdminApiError);
      expect(error).toMatchObject({
        code: "MFA_REQUIRED",
        message: "Verify again.",
        status: 403,
      });
    } finally {
      fetcher.mockRestore();
    }
  });

  test("a refusal without a JSON body falls back to the caller's sentence", async () => {
    const fetcher = stubFetch(new Response("Bad gateway", { status: 502 }));
    try {
      const error = await coreMutationDocument(
        "/api/roles",
        "PATCH",
        {},
        "Couldn't save the role.",
      ).catch((caught: unknown) => caught);
      expect(error).toMatchObject({
        code: undefined,
        message: "Couldn't save the role.",
        status: 502,
      });
    } finally {
      fetcher.mockRestore();
    }
  });
});
