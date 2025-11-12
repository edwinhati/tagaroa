import { createAdminProxy } from "@repo/common/lib/proxy";

const proxy = createAdminProxy({
  authAppUrl: process.env.NEXT_PUBLIC_AUTH_APP_URL!,
  verifyPath: "/verify-email",
  redirectUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL,
}) as unknown;

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    String.raw`/((?!api|_next/static|_next/image|favicon.ico|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.gif$|.*\.svg$|.*\.ico$).*)`,
  ],
};
