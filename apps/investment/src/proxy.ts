import { createBasicProxy } from "@repo/common/lib/proxy";

const proxy = createBasicProxy({
  authAppUrl: process.env.NEXT_PUBLIC_AUTH_APP_URL ?? "",
  verifyPath: "/verify-email",
  redirectUrl: process.env.NEXT_PUBLIC_MAIN_APP_URL,
  requireAdmin: false,
}) as unknown;

export default proxy;

export const proxyConfig = {
  matcher: [
    String.raw`/((?!api|_next/static|_next/image|favicon\.ico|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.gif$|.*\.svg$|.*\.ico$).*)`,
  ],
};
