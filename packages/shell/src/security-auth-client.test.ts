import { expect, it } from "bun:test";

import { authClient } from "./auth-client";
import type { SecurityAuthClient } from "./security-auth-client";

// Keep the consumer contract checked against the actual plugin client.
const security = authClient satisfies SecurityAuthClient;

it("provides the passkey and TOTP operations required by account security", async () => {
  expect(typeof security.passkey.addPasskey).toBe("function");
  const calls: Array<{ path: string; method?: string; body: unknown }> = [];
  const fetchOptions = {
    customFetchImpl: async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({
        path: new URL(String(url)).pathname,
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json({
        backupCodes: ["backup"],
        totpURI: "otpauth://totp/Tagaroa",
        id: "key",
      });
    },
  };
  await security.passkey.deletePasskey({ id: "key" }, fetchOptions);
  await security.passkey.listUserPasskeys({ fetchOptions });
  const enabled = await security.twoFactor.enable(
    { method: "totp", password: "secret" },
    fetchOptions,
  );
  const codes = await security.twoFactor.generateBackupCodes(
    { password: "secret" },
    fetchOptions,
  );
  await security.twoFactor.verifyTotp(
    { code: "012345", trustDevice: false },
    fetchOptions,
  );
  expect(enabled.data).toMatchObject({ totpURI: "otpauth://totp/Tagaroa" });
  expect(codes.data?.backupCodes).toEqual(["backup"]);
  expect(calls).toEqual([
    {
      path: "/api/auth/passkey/delete-passkey",
      method: "POST",
      body: { id: "key" },
    },
    { path: "/api/auth/passkey/list-user-passkeys", method: "GET", body: null },
    {
      path: "/api/auth/two-factor/enable",
      method: "POST",
      body: { method: "totp", password: "secret" },
    },
    {
      path: "/api/auth/two-factor/generate-backup-codes",
      method: "POST",
      body: { password: "secret" },
    },
    {
      path: "/api/auth/two-factor/verify-totp",
      method: "POST",
      body: { code: "012345", trustDevice: false },
    },
  ]);
});

it("preserves rejected TOTP verification as a structured error", async () => {
  const result = await security.twoFactor.verifyTotp(
    { code: "000000" },
    {
      customFetchImpl: async () =>
        Response.json(
          { code: "INVALID_TWO_FACTOR_CODE", message: "Invalid code" },
          { status: 400 },
        ),
    },
  );
  expect(result.data).toBeNull();
  expect(result.error).toMatchObject({
    code: "INVALID_TWO_FACTOR_CODE",
    message: "Invalid code",
    status: 400,
  });
});
