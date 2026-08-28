import { prepareTestDatabase, testEnv } from "./database";
import { seedE2eAdmin } from "./e2e-admin";

Object.assign(process.env, testEnv);
await prepareTestDatabase();
await seedE2eAdmin();
await import("../src/main");
