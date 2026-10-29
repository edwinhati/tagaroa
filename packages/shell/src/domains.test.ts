import { expect, test } from "bun:test";

import { domainsForSlugs } from "./domains";

test("domain admission uses exact server-owned slugs in registry order", () => {
  expect(
    domainsForSlugs(["sales", "finance", "finance", "unknown"]).map(
      (row) => row.slug,
    ),
  ).toEqual(["finance", "sales"]);
  expect(domainsForSlugs(["supply-chain"]).map((row) => row.slug)).toEqual([
    "supply-chain",
  ]);
  expect(domainsForSlugs(["Engineering", " supply CHAIN "])).toEqual([]);
  expect(domainsForSlugs([])).toEqual([]);
});
