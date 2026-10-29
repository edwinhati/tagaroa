import { describe, expect, test } from "bun:test";

import { renderEmail } from "./index.js";
import { paragraphs } from "./shell.js";

describe("paragraphs", () => {
  test("a blank line starts a new paragraph", () => {
    expect(paragraphs("one\n\ntwo")).toEqual([["one"], ["two"]]);
  });

  test("a single newline stays inside its paragraph", () => {
    expect(paragraphs("Address: a\nPassword: b")).toEqual([
      ["Address: a", "Password: b"],
    ]);
  });

  test("runs of blank lines do not produce empty paragraphs", () => {
    expect(paragraphs("one\n\n\n\ntwo\n\n")).toEqual([["one"], ["two"]]);
  });
});

describe("renderEmail", () => {
  const seeded = {
    body: "Ada,\n\nAn account has been created for you.\n\nAddress: ada@example.com\nTemporary password: hunter2",
    subject: "Your Tagaroa account",
  };

  test("keeps every line of the wording", async () => {
    const html = await renderEmail(seeded);

    expect(html).toContain("An account has been created for you.");
    expect(html).toContain("Address: ada@example.com");
    expect(html).toContain("Temporary password: hunter2");
  });

  test("breaks lines within a paragraph rather than joining them", async () => {
    const html = await renderEmail(seeded);

    expect(html).toMatch(/Address: ada@example\.com<br\s*\/?>/);
  });

  test("escapes the wording instead of emitting markup", async () => {
    const html = await renderEmail({
      body: "<script>alert(1)</script> & co",
      subject: null,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; co");
  });

  test("carries the subject as the inbox preview", async () => {
    const html = await renderEmail(seeded);

    expect(html).toContain("Your Tagaroa account");
  });

  test("says who to contact when the message was unexpected", async () => {
    const html = await renderEmail(seeded);

    expect(html).toContain("Contact your administrator through your");
    expect(html).toContain("usual trusted channel.");
    expect(html).not.toContain("support@tagaroa.example");
  });
});
