/**
 * Minimal Better Auth surface for account security ceremonies. Door and
 * workspace each pass their own client so cookies stay first-party on the door.
 */
export type SecurityAuthClient = {
  passkey: {
    addPasskey: (args: { name?: string }) => Promise<{
      data?: unknown;
      error?: { code?: string; message?: string } | null;
    }>;
    deletePasskey: (args: {
      id: string;
    }) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
    listUserPasskeys: () => Promise<{
      data?: Array<{ id: string; name?: string | null }> | null;
      error?: { message?: string } | null;
    }>;
  };
  twoFactor: {
    enable: (args: { method: "totp"; password: string }) => Promise<{
      data?: {
        method?: string;
        totpURI?: string;
        backupCodes?: string[];
      } | null;
      error?: unknown;
    }>;
    generateBackupCodes: (args: { password: string }) => Promise<{
      data?: { backupCodes?: string[] } | null;
      error?: unknown;
    }>;
    verifyTotp: (args: {
      code: string;
      trustDevice?: boolean;
    }) => Promise<{ data?: unknown; error?: unknown }>;
  };
};
