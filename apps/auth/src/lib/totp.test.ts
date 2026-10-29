import { expect, test } from "bun:test";

import { formatSetupKey, setupKeyFromTotpUri } from "./totp";

test("reads and formats the manual key from a TOTP enrollment URI", () => {
  const uri =
    "otpauth://totp/Tagaroa:ana%40tagaroa.test?secret=JBSWY3DPEHPK3PXP&issuer=Tagaroa";

  expect(setupKeyFromTotpUri(uri)).toBe("JBSWY3DPEHPK3PXP");
  expect(formatSetupKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
});

test("refuses malformed or non-TOTP setup links", () => {
  expect(setupKeyFromTotpUri("https://tagaroa.test/?secret=ABCDEF")).toBeNull();
  expect(setupKeyFromTotpUri("not a url")).toBeNull();
  expect(
    setupKeyFromTotpUri("otpauth://totp/Tagaroa?secret=not-valid"),
  ).toBeNull();
});
