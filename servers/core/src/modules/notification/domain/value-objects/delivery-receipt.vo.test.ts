import { expect, test } from "bun:test";

import { replaceableBy } from "./delivery-receipt.vo";

test("a late receipt never moves a message backwards", () => {
  expect(replaceableBy("sent")).not.toContain("delivered");
  expect(replaceableBy("sent")).not.toContain("bounced");
  expect(replaceableBy("delivered")).not.toContain("bounced");
});

test("a bounce outranks a delivery, and nothing reopens a message never sent", () => {
  expect(replaceableBy("bounced")).toContain("delivered");
  for (const status of ["sent", "delivered", "bounced"] as const)
    for (const closed of ["pending", "sending", "failed", "suppressed"])
      expect(replaceableBy(status)).not.toContain(closed);
});
