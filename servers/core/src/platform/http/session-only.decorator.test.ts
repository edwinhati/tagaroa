import "reflect-metadata";
import { expect, test } from "bun:test";

import { Reflector } from "@nestjs/core";

import { SESSION_ONLY, SessionOnly } from "./session-only.decorator";

@SessionOnly()
class SelfRoutes {
  me() {}
}

class Routes {
  @SessionOnly()
  me() {}
  other() {}
}

test("marks a handler or a whole controller as open to any signed-in person", () => {
  const reflector = new Reflector();
  const sessionOnly = (handler: () => void, controller: object) =>
    reflector.getAllAndOverride<boolean>(SESSION_ONLY, [
      handler,
      controller as never,
    ]);

  expect(sessionOnly(Routes.prototype.me, Routes)).toBe(true);
  expect(sessionOnly(Routes.prototype.other, Routes)).toBeUndefined();
  expect(sessionOnly(SelfRoutes.prototype.me, SelfRoutes)).toBe(true);
});
