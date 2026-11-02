import { describe, expect, test } from "bun:test";

import { renderEmail } from "./index.js";
import { paragraphs } from "./shell.js";

describe("paragraphs", () => {
  test.each(["", "\n", "\n\n\n", "   \n\t\n"])(
    "omits empty or whitespace-only input %p",
    (body) => {
      expect(paragraphs(body)).toEqual([]);
    },
  );

  test("trims trailing whitespace while preserving indentation and blank lines", () => {
    expect(paragraphs("  Ada  \n \nNext\t\n\n  Last  ")).toEqual([
      ["  Ada", "", "Next"],
      ["  Last"],
    ]);
  });

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

  test("renders a complete document without unresolved shell placeholders", async () => {
    const html = await renderEmail(seeded);

    expect(html).toMatch(/^<!DOCTYPE html/);
    expect(html).toMatch(/<html\b[^>]*\blang="en"/);
    expect(html).toContain("<head>");
    expect(html).toContain("<body");
    expect(html).toContain("</html>");
    expect(html).toContain("Ada,");
    expect(html).toContain("Tagaroa");
    expect(html).not.toMatch(/\{\{|\}\}|\{%|%\}|\$\{/);
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("[object Object]");
  });

  test("escapes user-controlled subject and body independently", async () => {
    const html = await renderEmail({
      body: '<img src=x onerror="alert(1)"> & <a href="javascript:alert(2)">click</a>',
      subject: '</div><script>alert("subject")</script> & "preview"',
    });

    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain(
      "&lt;a href=&quot;javascript:alert(2)&quot;&gt;click&lt;/a&gt;",
    );
    expect(html).toContain(
      "&lt;/div&gt;&lt;script&gt;alert(&quot;subject&quot;)&lt;/script&gt; &amp; &quot;preview&quot;",
    );
    expect(html).not.toMatch(/<script|<img|<a\s/i);
  });

  test("keeps Unicode and literal entities without interpreting user markup", async () => {
    const html = await renderEmail({
      body: "こんにちは Ada 👋\n\n&lt;b&gt; & 'quoted'",
      subject: "Réinitialisation 🔐",
    });

    expect(html).toContain("こんにちは Ada 👋");
    expect(html).toContain("Réinitialisation 🔐");
    expect(html).toContain("&amp;lt;b&amp;gt; &amp; &#x27;quoted&#x27;");
  });

  test.each([null, ""])(
    "renders a body when the subject is %p",
    async (subject) => {
      const html = await renderEmail({
        body: "Body without a preview",
        subject,
      });

      expect(html).toContain("Body without a preview");
      expect(html.includes('data-skip-in-text="true"')).toBe(subject !== null);
      expect(html).not.toContain("null");
    },
  );

  test.each(["", " \n\n\t"])(
    "keeps the subject and footer with an empty body %p",
    async (body) => {
      const html = await renderEmail({ body, subject: "Preview only" });

      expect(html).toContain("Preview only");
      expect(html).toContain("Contact your administrator through your");
      expect(html.match(/<p\b/g)).toHaveLength(1);
    },
  );

  test("says who to contact when the message was unexpected", async () => {
    const html = await renderEmail(seeded);

    expect(html).toContain("Contact your administrator through your");
    expect(html).toContain("usual trusted channel.");
    expect(html).not.toContain("support@tagaroa.example");
  });
});
