import { describe, expect, test } from "bun:test";

import {
  listUsersQuery,
  type PeopleQuery,
  standingOf,
  validatePeopleSearch,
} from "./people";

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

  test("the admins slice covers every privileged role", () => {
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
    // The router lays the validated search over the raw query.
    const raw = {
      page: 0,
      role: "owner",
      size: 500,
      slice: "active",
      sort: "account,access",
    };
    const search: Record<string, unknown> = {
      ...raw,
      ...validatePeopleSearch(raw),
    };
    expect(search).toEqual({});
  });

  test("degrades a stale multi-role link to its first valid role", () => {
    expect(validatePeopleSearch({ role: ["admin", "helpdesk"] })).toEqual({
      role: "admin",
    });
  });
});
