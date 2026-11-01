import { expect, spyOn, test } from "bun:test";

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
      accounts.set(id, { banned: false, email, id, privileged: false });
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
    lifecycle,
    linkRepository,
    source,
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
    privileged: false,
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

test("a leaver whose company email is an administrator's is neither adopted nor retired", async () => {
  const leaver: Employee = { ...ada, relievingDate: today, status: "Left" };
  const { accounts, links, retired, sync } = world([leaver]);
  accounts.set("admin", {
    banned: false,
    email: "ada@tagaroa.example",
    id: "admin",
    privileged: true,
  });

  const action = await sync.execute(leaver, today);
  expect(action).toMatchObject({ kind: "none", reason: expect.any(String) });
  expect(links.size).toBe(0);
  expect(retired).toEqual([]);

  accounts.get("admin")!.privileged = false;
  expect(await sync.execute(leaver, today)).toEqual({ kind: "offboard" });
  expect(retired).toEqual(["admin"]);
});

test("a linked account promoted since is not retired when its record leaves", async () => {
  const { accounts, retired, sync } = world();
  await sync.execute(ada, today);
  accounts.get("user-1")!.privileged = true;

  const left: Employee = { ...ada, relievingDate: today, status: "Left" };
  expect((await sync.execute(left, today)).kind).toBe("none");
  expect(retired).toEqual([]);
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

test("a linked account takes precedence over the current email holder", async () => {
  const { accounts, links, lifecycle, retired, sync } = world();
  accounts.set("linked", {
    banned: false,
    email: "old@tagaroa.example",
    id: "linked",
  });
  accounts.set("holder", {
    banned: false,
    email: ada.companyEmail!,
    id: "holder",
  });
  links.set(ada.name, "linked");
  const lookup = spyOn(lifecycle, "byEmail");
  await sync.execute({ ...ada, status: "Left", relievingDate: today }, today);
  expect(retired).toEqual(["linked"]);
  expect(lookup).not.toHaveBeenCalled();
});

test("a matching reverse link uses the account without relinking it", async () => {
  const { accounts, linkRepository, sync, issued } = world();
  accounts.set("manual", {
    banned: false,
    email: ada.companyEmail!,
    id: "manual",
  });
  spyOn(linkRepository, "employeeFor").mockResolvedValue(ada.name);
  const link = spyOn(linkRepository, "link");
  expect(await sync.execute(ada, today)).toEqual({ kind: "none" });
  expect(link).not.toHaveBeenCalled();
  expect(issued).toEqual([]);
});

test("an active employee never restores a suspended linked account", async () => {
  const { accounts, links, issued, retired, sync } = world();
  accounts.set("suspended", {
    banned: true,
    email: ada.companyEmail!,
    id: "suspended",
  });
  links.set(ada.name, "suspended");
  expect(await sync.execute(ada, today)).toEqual({
    kind: "none",
    reason: "Active in HR but suspended here",
  });
  expect(accounts.get("suspended")!.banned).toBe(true);
  expect(issued).toEqual([]);
  expect(retired).toEqual([]);
});

test("missing addresses do not issue an account or look up an absent company email", async () => {
  const { lifecycle, issued, links, sync } = world();
  const lookup = spyOn(lifecycle, "byEmail");
  expect((await sync.execute({ ...ada, companyEmail: null }, today)).kind).toBe(
    "none",
  );
  expect(lookup).not.toHaveBeenCalled();
  expect(
    (await sync.execute({ ...ada, personalEmail: null }, today)).kind,
  ).toBe("none");
  expect(issued).toEqual([]);
  expect(links.size).toBe(0);
});

test("a webhook re-reads the employee and propagates source failure without wedging the queue", async () => {
  const { source, issued, sync } = world();
  const read = spyOn(source, "employee").mockRejectedValueOnce(
    new Error("source unavailable"),
  );
  await expect(sync.execute(ada.name, today)).rejects.toThrow(
    "source unavailable",
  );
  expect(issued).toEqual([]);
  expect(await sync.execute(ada.name, today)).toEqual({ kind: "issue" });
  expect(read).toHaveBeenCalledWith(ada.name);
  expect(issued).toHaveLength(1);
});

test("a failed link after issuance is recovered by adopting the existing account", async () => {
  const { linkRepository, issued, links, sync } = world();
  spyOn(linkRepository, "link").mockRejectedValueOnce(new Error("link failed"));
  await expect(sync.execute(ada, today)).rejects.toThrow("link failed");
  expect(links.size).toBe(0);
  expect((await sync.execute(ada, today)).kind).toBe("none");
  expect(issued).toHaveLength(1);
  expect(links.get(ada.name)).toBe("user-1");
});

test("retirement includes the HR record and relieving date and runs only once", async () => {
  const { lifecycle, sync } = world();
  await sync.execute(ada, today);
  const retire = spyOn(lifecycle, "retire");
  const leaver = { ...ada, status: "Left", relievingDate: today };
  await sync.execute(leaver, today);
  await sync.execute(leaver, today);
  expect(retire).toHaveBeenCalledTimes(1);
  expect(retire).toHaveBeenCalledWith(
    "user-1",
    `Left per Frappe HR ${ada.name}, relieved ${today}`,
  );
});

test("issuance forwards onboarding details and links even when onboarding was not queued", async () => {
  const { lifecycle, links, sync } = world();
  const issue = spyOn(lifecycle, "issue").mockResolvedValue({
    id: "new-user",
    onboardingQueued: false,
  });
  expect(await sync.execute({ ...ada, displayName: null }, today)).toEqual({
    kind: "issue",
  });
  expect(issue).toHaveBeenCalledWith({
    email: ada.companyEmail!,
    name: ada.companyEmail!,
    personalEmail: ada.personalEmail!,
    source: `Frappe HR ${ada.name}`,
  });
  expect(links.get(ada.name)).toBe("new-user");
});
