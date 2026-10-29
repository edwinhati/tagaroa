import { expect, mock, test } from "bun:test";

import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { DATABASE, type Database, DatabaseModule } from "./database.module";

@Global()
@Module({
  exports: [ConfigService],
  providers: [
    {
      provide: ConfigService,
      useValue: {
        get: () => "postgres://user:password@localhost:5432/tagaroa",
      },
    },
  ],
})
class FakeConfigModule {}

@Module({ imports: [FakeConfigModule, DatabaseModule.register({})] })
class TestModule {}

test("provides the database and closes its client on shutdown", async () => {
  const app = await NestFactory.createApplicationContext(TestModule, {
    logger: false,
  });
  const database = app.get<Database>(DATABASE);
  const end = mock(async () => {});
  database.$client.end = end;

  await app.close();

  expect(end).toHaveBeenCalledTimes(1);
});
