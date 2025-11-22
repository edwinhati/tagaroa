import { createAuthClient } from "better-auth/react";
import { oidcClient, adminClient, jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_API_URL,
	plugins: [adminClient(), oidcClient(), jwtClient()],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;
