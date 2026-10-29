import { expect, test } from "bun:test";

import type {
  AccountLifecycle,
  AccountState,
} from "../../../auth/account-lifecycle.facade";
import type { Employee } from "../../domain/employee";
import type { EmployeeLinkRepository } from "../../domain/repositories/employee-link.repository";
import type { EmployeeSource } from "../../domain/repositories/employee-source.port";
import { SyncEmployeeUseCase } from "./sync-employee.use-case";

const today = "2026-10-26";
const ada: Employee = {
  companyEmail: "ada@tagaroa.example",
  displayName: "Ada Lovelace",
  name: "HR-EMP-00001",
  personalEmail: "ada@home.example",
  relievingDate: null,
  status: "Active",
};

/** Accounts and links held in memory, recording what was done to them. */
const world = (records: Employee[] = [ada]) => {
  const accounts = new Map<string, AccountState & { email: string }>();
  const links = new Map<string, string>();
  const issued: string[] = [];
  const retired: string[] = [];

  const lifecycle: AccountLifecycle = {
    byEmail: async (email) =>
      [...accounts.values()].find((account) => account.email === email) ?? null,
    byId: async (id) => accounts.get(id) ?? null,
    async issue({ email }) {
      if ([...accounts.values()].some((account) => account.email === email))
        throw new Error("taken");
      const id = `user-${accounts.size + 1}`;
      accounts.set(id, { banned: false, email, id });
      issued.push(email);
      return { id, onboardingQueued: true };
    },
    async retire(id) {
      accounts.get(id)!.banned = true;
      retired.push(id);
    },
  };
  const linkRepository: EmployeeLinkRepository = {
    accountFor: async (employee) => links.get(employee) ?? null,
    employeeFor: async (accountId) =>
      [...links].find(([, id]) => id === accountId)?.[0] ?? null,
    link: async (employee, accountId) => void links.set(employee, accountId),
  };
  const source: EmployeeSource = {
    employee: async (name) => records.find((record) => record.name === name),
    employees: async () => records,
  };

  return {
    accounts,
    issued,
    links,
    retired,
    sync: new SyncEmployeeUseCase(source, linkRepository, lifecycle),
  };
};

test("a joiner is issued an account and linked to it", async () => {
  const { issued, links, sync } = world();

  expect(await sync.execute(ada, today)).toEqual({ kind: "issue" });
  expect(issued).toEqual(["ada@tagaroa.example"]);
  expect(links.get(ada.name)).toBe("user-1");
});

test("an account issued by hand before HR is adopted, not issued twice", async () => {
  const { accounts, issued, links, sync } = world();
  accounts.set("manual", {
    banned: false,
    email: "ada@tagaroa.example",
    id: "manual",
  });

  expect((await sync.execute(ada, today)).kind).toBe("none");
  expect(issued).toEqual([]);
  expect(links.get(ada.name)).toBe("manual");
});

test("a leaver is found through the link after their company email changed", async () => {
  const { retired, sync } = world();
  await sync.execute(ada, today);

  const renamed: Employee = {
    ...ada,
    companyEmail: "ada.lovelace@tagaroa.example",
    relievingDate: today,
    status: "Left",
  };
  expect(await sync.execute(renamed, today)).toEqual({ kind: "offboard" });
  expect(retired).toEqual(["user-1"]);
});

test("an address held by another record's account is reported, not taken", async () => {
  const { issued, retired, sync } = world();
  await sync.execute(ada, today);

  const other: Employee = {
    ...ada,
    name: "HR-EMP-00002",
    relievingDate: today,
    status: "Left",
  };
  expect((await sync.execute(other, today)).kind).toBe("none");
  expect(retired).toEqual([]);
  expect(issued).toHaveLength(1);
});

test("a webhook and a pass naming one joiner at once issue one account", async () => {
  const { issued, sync } = world();

  const outcomes = await Promise.all([
    sync.execute(ada.name, today),
    sync.execute(ada, today),
  ]);
  expect(outcomes.map((outcome) => outcome.kind)).toEqual(["issue", "none"]);
  expect(issued).toHaveLength(1);
});

test("a name the source does not know changes nothing", async () => {
  const { issued, sync } = world();
  expect(await sync.execute("HR-EMP-99999", today)).toEqual({ kind: "none" });
  expect(issued).toEqual([]);
});
