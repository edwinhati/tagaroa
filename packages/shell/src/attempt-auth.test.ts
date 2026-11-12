import { describe, expect, it } from "bun:test";

import { attemptAuth, authCall } from "./attempt-auth";

describe("attemptAuth", () => {
  it("returns successful data, including null and absent data", async () => {
    for (const data of [{ id: "session" }, null, undefined]) {
      expect(await attemptAuth(async () => ({ data }), "Denied")).toEqual({
        data,
      });
    }
  });

  it("reports synchronous throws and rejected requests as unreachable", async () => {
    for (const call of [
      () => {
        throw new Error("private transport details");
      },
      () => Promise.reject("offline"),
    ]) {
      expect(await attemptAuth(call, "Denied")).toEqual({
        failure: "Can't reach the sign-in service. Try again in a moment.",
      });
    }
  });

  it("preserves the server message and string code without returning data", async () => {
    expect(
      await attemptAuth(
        async () => ({
          data: { id: "must-not-use" },
          error: { code: "INVALID_PASSWORD", message: "Check your password." },
        }),
        "Denied",
      ),
    ).toEqual({
      code: "INVALID_PASSWORD",
      failure: "Check your password.",
    });
  });

  it("uses the caller's fallback for malformed errors and omits non-string codes", async () => {
    for (const error of [
      "denied",
      {},
      { message: "", code: 403 },
      { message: 42 },
    ]) {
      expect(
        await attemptAuth(async () => ({ error }), "Sign-in denied."),
      ).toEqual({
        failure: "Sign-in denied.",
      });
    }
    expect(
      await attemptAuth(
        async () => ({ error: { code: "MFA_REQUIRED" } }),
        "Use MFA.",
      ),
    ).toEqual({
      code: "MFA_REQUIRED",
      failure: "Use MFA.",
    });
  });
});

describe("authCall", () => {
  it("throws the server's sentence, or the caller's when there is none or no answer", async () => {
    expect(await authCall(async () => ({ data: 1 }), "Not saved.")).toBe(1);
    await expect(
      authCall(async () => ({ error: { message: "Too long." } }), "Not saved."),
    ).rejects.toThrow("Too long.");
    for (const call of [
      async () => ({ error: {} }),
      () => Promise.reject(new TypeError("NetworkError")),
    ]) {
      await expect(authCall(call, "Not saved.")).rejects.toThrow("Not saved.");
    }
  });
});
