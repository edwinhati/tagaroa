import { expect, mock, test } from "bun:test";

import { DATABASE, type Database, DatabaseModule } from "./database.module";

test("registers the database provider", () => {
  const registration = DatabaseModule.register({});
  const provider = registration.providers?.[0] as {
    provide: symbol;
    useFactory: (config: { get: () => string }) => Database;
  };

  expect(registration.exports).toEqual([DATABASE]);
  expect(provider.provide).toBe(DATABASE);
  expect(
    provider.useFactory({
      get: () => "postgres://user:password@localhost:5432/tagaroa",
    }),
  ).toBeDefined();
});

test("closes the database client", async () => {
  const close = mock(async () => {});
  const module = new DatabaseModule({
    $client: { close },
  } as unknown as Database);

  await module.onModuleDestroy();

  expect(close).toHaveBeenCalledTimes(1);
});
