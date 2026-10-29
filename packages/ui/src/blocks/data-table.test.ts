import { expect, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DataTableExportButton,
  DataTableSelectionCell,
  DataTableSelectionHeader,
  DataTableSkeleton,
  toCsv,
} from "./data-table.js";

test("toCsv preserves commas, quotes, and sparse fields", () => {
  expect(toCsv([{ name: 'Ada, "A"', role: "admin" }, { name: "Lin" }])).toBe(
    '"name","role"\n"Ada, ""A""","admin"\n"Lin",""',
  );
});

test("selection controls and loading state carry accessible names", () => {
  const markup = renderToStaticMarkup(
    createElement("div", null, [
      createElement(DataTableSelectionHeader, {
        checked: "indeterminate",
        key: "header",
        onCheckedChange: () => undefined,
      }),
      createElement(DataTableSelectionCell, {
        checked: false,
        key: "cell",
        onCheckedChange: () => undefined,
      }),
      createElement(DataTableSkeleton, { key: "skeleton" }),
    ]),
  );

  expect(markup).toContain('aria-label="Select all rows"');
  expect(markup).toContain('aria-label="Select row"');
  expect(markup).toContain('aria-label="Loading table"');
  expect(markup).toContain('aria-busy="true"');
});

test("export is unavailable when there are no rows", () => {
  const markup = renderToStaticMarkup(
    createElement(DataTableExportButton, {
      filename: "people.csv",
      rows: [],
    }),
  );

  expect(markup).toContain("disabled");
  expect(markup).toContain("Export");
});
