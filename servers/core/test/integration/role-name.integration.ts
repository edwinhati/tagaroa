import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { AccessControlService } from "../../src/modules/access-control/application/access-control.service";
import { DrizzleAccessControlRepository } from "../../src/modules/access-control/infrastructure/persistence/drizzle/drizzle-access-control.repository";
import type { Database } from "../../src/platform/database/database.module";
import { prepareTestDatabase, testEnv } from "../database";

Object.assign(process.env, testEnv);
setDefaultTimeout(60_000);

const TOKEN = `rolename${crypto.randomUUID().replaceAll("-", "")}`;
const USER = `${TOKEN}-user`;
const actor = {
  id: USER,
  impersonatedBy: null,
  role: "super-admin",
  sessionCreatedAt: new Date(),
  sessionId: `${TOKEN}-session`,
  twoFactorEnabled: true,
};
const input = (key: string, name: string) => ({
  description: "Configure assigned domains",
  key: `${TOKEN}-${key}`,
  name,
  permissions: ["domain:administer" as const],
});

let client: SQL;
let repository: DrizzleAccessControlRepository;
const audit = { recent: async () => [], record: async () => undefined };

beforeAll(async () => {
  await prepareTestDatabase();
  client = new SQL(testEnv.DATABASE_URL);
  repository = new DrizzleAccessControlRepository(
    drizzle({ client }) as Database,
  );
  await client`insert into auth."user" (id, name, email, created_at, updated_at) values (${USER}, 'Role name fixture', ${`${TOKEN}@tagaroa.test`}, now(), now())`;
});

afterAll(async () => {
  await client`delete from access_control.access_role where id in (select id from access_control.access_role where key like ${`${TOKEN}%`})`;
  await client`delete from auth."user" where id = ${USER}`;
  await client.close();
});

describe("role names are unique ignoring case", () => {
  test("a case-only clash answers 409 on create and rename", async () => {
    const service = new AccessControlService(repository, audit);
    await service.createRole(input("a", `${TOKEN} Finance`), actor);
    await expect(
      service.createRole(input("b", `${TOKEN} finance`), actor),
    ).rejects.toMatchObject({ status: 409 });

    const other = await service.createRole(input("c", `${TOKEN} Ops`), actor);
    await expect(
      service.updateRole(other!.id, input("c", `${TOKEN} FINANCE`), actor),
    ).rejects.toMatchObject({ status: 409 });
  });

  test("losing the race to the unique index still answers 409", async () => {
    await new AccessControlService(repository, audit).createRole(
      input("d", `${TOKEN} Audit`),
      actor,
    );
    const blind = new AccessControlService(
      Object.assign(Object.create(repository), {
        roleKeyOrNameExists: async () => false,
      }),
      audit,
    );
    await expect(
      blind.createRole(input("e", `${TOKEN} AUDIT`), actor),
    ).rejects.toMatchObject({ status: 409 });
  });

  test("losing a rename race to the unique index still answers 409", async () => {
    const service = new AccessControlService(repository, audit);
    await service.createRole(input("f", `${TOKEN} Payroll`), actor);
    const other = await service.createRole(
      input("g", `${TOKEN} Treasury`),
      actor,
    );
    const blind = new AccessControlService(
      Object.assign(Object.create(repository), {
        roleKeyOrNameExists: async () => false,
      }),
      audit,
    );
    await expect(
      blind.updateRole(other!.id, input("g", `${TOKEN} PAYROLL`), actor),
    ).rejects.toMatchObject({ status: 409 });
    expect((await repository.findRole(other!.id))?.name).toBe(
      `${TOKEN} Treasury`,
    );
  });
});
