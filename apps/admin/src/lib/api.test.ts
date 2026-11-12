import { describe, expect, spyOn, test } from "bun:test";

import { CORE_URL } from "@repo/shell/urls";

import { AdminApiError, coreMutationDocument } from "./api";

describe("coreMutationDocument", () => {
  /** Answers every fetch with `response` and records what was asked. */
  function stubFetch(response: Response) {
    return spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(async () => response, {
        preconnect: globalThis.fetch.preconnect,
      }),
    );
  }

  test("sends a JSON body and returns the document's data", async () => {
    const fetcher = stubFetch(Response.json({ data: { id: "r1" } }));
    try {
      await expect(
        coreMutationDocument("/api/roles", "POST", { name: "Ops" }, "Failed"),
      ).resolves.toEqual({ id: "r1" });
      const [url, init] = fetcher.mock.calls[0]!;
      expect(url).toBe(`${CORE_URL}/api/roles`);
      expect(init).toMatchObject({
        body: JSON.stringify({ name: "Ops" }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    } finally {
      fetcher.mockRestore();
    }
  });

  test("a bodiless call sends no body and no content type", async () => {
    const fetcher = stubFetch(Response.json({ data: { removed: true } }));
    try {
      await coreMutationDocument(
        "/api/roles/r1",
        "DELETE",
        undefined,
        "Failed",
      );
      const init = fetcher.mock.calls[0]![1]!;
      expect(init).not.toHaveProperty("body");
      expect(init.headers).toBeUndefined();
      expect(init.method).toBe("DELETE");
    } finally {
      fetcher.mockRestore();
    }
  });

  test("a refusal carries the server's message, code, and status", async () => {
    const fetcher = stubFetch(
      Response.json(
        { code: "MFA_REQUIRED", message: "Verify again." },
        { status: 403 },
      ),
    );
    try {
      const error = await coreMutationDocument(
        "/api/roles",
        "POST",
        {},
        "Failed",
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AdminApiError);
      expect(error).toMatchObject({
        code: "MFA_REQUIRED",
        message: "Verify again.",
        status: 403,
      });
    } finally {
      fetcher.mockRestore();
    }
  });

  test("a refusal without a JSON body falls back to the caller's sentence", async () => {
    const fetcher = stubFetch(new Response("Bad gateway", { status: 502 }));
    try {
      const error = await coreMutationDocument(
        "/api/roles",
        "PATCH",
        {},
        "Couldn't save the role.",
      ).catch((caught: unknown) => caught);
      expect(error).toMatchObject({
        code: undefined,
        message: "Couldn't save the role.",
        status: 502,
      });
    } finally {
      fetcher.mockRestore();
    }
  });
});
