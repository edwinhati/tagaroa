import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { Field } from "./auth-shell";

// Server rendering is enough for what Field decides: which input it picks and
// how the error is wired to it. Interaction stays with the Playwright suite.
const render = (props: Partial<Parameters<typeof Field>[0]> = {}) =>
  renderToStaticMarkup(<Field id="email" label="Email" {...props} />);

describe("Field", () => {
  test("labels the input by its id", () => {
    const html = render({ type: "email" });
    expect(html).toContain('for="email"');
    expect(html).toContain('id="email"');
    expect(html).toContain('type="email"');
  });

  test("an error marks the input invalid and points it at the message", () => {
    const html = render({ error: "Enter the email your account uses." });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-error"');
    expect(html).toContain('id="email-error"');
    expect(html).toContain("Enter the email your account uses.");
  });

  test("without an error nothing claims to be invalid", () => {
    const html = render();
    expect(html).not.toContain("aria-invalid=");
    expect(html).not.toContain("aria-describedby=");
    expect(html).not.toContain("email-error");
  });

  test("a password field uses the password input", () => {
    const html = render({
      id: "password",
      label: "Password",
      type: "password",
    });
    expect(html).toContain('type="password"');
    expect(html).toContain('id="password"');
  });

  test("shows the hint beside the label", () => {
    expect(render({ hint: "From your welcome email" })).toContain(
      "From your welcome email",
    );
  });
});
