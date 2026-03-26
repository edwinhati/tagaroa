import { adminClient, multiSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// biome-ignore lint/suspicious/noExplicitAny: Better Auth's return type is complex and not easily nameable
export const authClient: any = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  plugins: [adminClient(), multiSessionClient()],
});
