import { SQL } from "bun";

import { prepareTestDatabase, testEnv } from "./database";
import { seedE2eAdmin } from "./e2e-admin";

Object.assign(process.env, testEnv);
await prepareTestDatabase();
await seedE2eAdmin();
const sql = new SQL(testEnv.DATABASE_URL);
await sql`update auth."user" set role = 'super-admin', must_change_password = false where email = 'e2e-admin@tagaroa.test'`;
await sql.close();
await import("../src/main");
