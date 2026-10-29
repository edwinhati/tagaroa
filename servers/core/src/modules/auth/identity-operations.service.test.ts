import { expect, test } from "bun:test";

import {
  requireVerifiedOperator,
  type IdentityOperator,
} from "./identity-operations.service";

test("security operations require a fresh, non-impersonated MFA operator", () => {
  const actor: IdentityOperator = {
    id: "operator",
    role: "super-admin",
    twoFactorEnabled: true,
    sessionCreatedAt: new Date(),
  };
  expect(() => requireVerifiedOperator(actor)).not.toThrow();
  for (const change of [
    { impersonatedBy: "other" },
    { twoFactorEnabled: false },
    { sessionCreatedAt: new Date("invalid") },
    { sessionCreatedAt: new Date(Date.now() + 60_000) },
    { sessionCreatedAt: new Date(Date.now() - 15 * 60_000) },
  ])
    expect(() => requireVerifiedOperator({ ...actor, ...change })).toThrow();
});
