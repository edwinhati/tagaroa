import { describe, expect, test } from "bun:test";

import { signedOAuthQuery } from "./oauth";

describe("signedOAuthQuery", () => {
  test("is undefined on an ordinary visit", () => {
    expect(signedOAuthQuery("")).toBeUndefined();
    expect(signedOAuthQuery("?redirect=/locked-out")).toBeUndefined();
    // A signature without the list of what it signed cannot be checked.
    expect(signedOAuthQuery("?client_id=netbird&sig=abc")).toBeUndefined();
  });

  test("keeps exactly what core signed, and drops anything added after", () => {
    expect(
      signedOAuthQuery(
        "?client_id=netbird&prompt=consent&ba_param=ba_param&ba_param=client_id&ba_param=prompt&sig=abc&redirect=/elsewhere",
      ),
    ).toBe(
      "client_id=netbird&prompt=consent&ba_param=ba_param&ba_param=client_id&ba_param=prompt&sig=abc",
    );
  });
});
