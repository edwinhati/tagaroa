import { afterAll, beforeAll, expect, test } from "bun:test";

import { Controller, Get, type INestApplication, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import {
  minutes,
  SkipThrottle,
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
} from "@nestjs/throttler";

import { rateLimitOptions } from "./rate-limit";

@Controller()
class FixtureController {
  @Get("read")
  read() {
    return { data: "ok" };
  }

  @Get("hook")
  @Throttle({ default: { limit: 1, ttl: minutes(1) } })
  hook() {
    return { data: "ok" };
  }

  @Get("probe")
  @SkipThrottle()
  probe() {
    return { data: "ok" };
  }
}

const options = rateLimitOptions({
  nodeEnv: "production",
  trustedProxies: ["10.0.0.0/8"],
});

@Module({
  controllers: [FixtureController],
  imports: [
    ThrottlerModule.forRoot({
      ...(options as Exclude<typeof options, unknown[]>),
      throttlers: [{ limit: 2, ttl: minutes(1) }],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class FixtureModule {}

let app: INestApplication;
let base: string;

beforeAll(async () => {
  app = await NestFactory.create(FixtureModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

afterAll(() => app.close());

// Each caller arrives through the same trusted proxy, as they do in production.
const from = (client: string, path = "/read") =>
  fetch(`${base}${path}`, {
    headers: { "x-forwarded-for": `${client}, 10.0.0.4` },
  }).then((response) => response.status);

test("each client behind the proxy has its own count", async () => {
  expect(await from("203.0.113.7")).toBe(200);
  expect(await from("203.0.113.7")).toBe(200);
  expect(await from("203.0.113.7")).toBe(429);
  expect(await from("198.51.100.66")).toBe(200);
});

test("a route can take a tighter limit, and a probe none", async () => {
  expect(await from("192.0.2.10", "/hook")).toBe(200);
  expect(await from("192.0.2.10", "/hook")).toBe(429);
  for (let call = 0; call < 5; call += 1)
    expect(await from("192.0.2.10", "/probe")).toBe(200);
});
