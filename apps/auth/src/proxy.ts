import { resolveSafeRedirect } from "@repo/common/lib/redirect";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Route Definitions
const routes = {
  protected: new Set<string>([]), // Add other protected routes here
  public: new Set<string>(["/sign-in"]),
};

/**
 * Checks if a route requires authentication
 */
const isRouteProtected = (pathname: string): boolean =>
  routes.protected.has(pathname);

/**
 * Checks if a route is public (no auth required)
 */
const isPublicRoute = (pathname: string): boolean =>
  routes.public.has(pathname);

/**
 * Handle redirects based on user verification status
 */
function handleVerificationRedirects(
  request: NextRequest,
  pathname: string,
  isVerified: boolean,
): NextResponse {
  // Allow verification-related routes regardless of verification status
  const verificationRoutes = ["/verify-email", "/verify-email/callback"];
  const isVerificationRoute = verificationRoutes.some((route) =>
    pathname.startsWith(route),
  );

  if (!isVerified) {
    // Allow access to verification routes and public auth routes
    if (
      isVerificationRoute ||
      isPublicRoute(pathname) ||
      pathname.startsWith("/sign-")
    ) {
      return NextResponse.next();
    }

    // Redirect unverified users to verification page for protected routes
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }

  // For verified users, redirect away from verification pages to dashboard
  if (isVerificationRoute) {
    const searchParams = request.nextUrl.searchParams;
    const rawRedirect = searchParams.get("redirect");
    const base = (process.env.NEXT_PUBLIC_DASHBOARD_APP_URL as string) || "/";
    const safe = resolveSafeRedirect(rawRedirect, base);
    return NextResponse.redirect(new URL(safe, request.url));
  }

  // Handle root path for authenticated users - redirect to sign-in
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Redirect verified users away from public auth routes to dashboard
  // EXCEPT when they're explicitly logging out
  if (isPublicRoute(pathname)) {
    const searchParams = request.nextUrl.searchParams;
    const isLogout = searchParams.get("logout") === "true";

    // Don't redirect if user is explicitly logging out
    if (isLogout) {
      return NextResponse.next();
    }

    const rawRedirect = searchParams.get("redirect");
    const base = (process.env.NEXT_PUBLIC_DASHBOARD_APP_URL as string) || "/";
    const safe = resolveSafeRedirect(rawRedirect, base);
    return NextResponse.redirect(new URL(safe, request.url));
  }

  return NextResponse.next();
}

/**
 * Handle unauthenticated user access
 */
function handleUnauthenticated(
  request: NextRequest,
  pathname: string,
  safeRedirect: string,
): NextResponse {
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (isRouteProtected(pathname)) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?redirect=${encodeURIComponent(safeRedirect)}`,
        request.url,
      ),
    );
  }

  return NextResponse.next();
}

/**
 * Verify session with backend
 */
async function verifySessionWithBackend(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  emailVerified: boolean;
}> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${apiUrl}/api/auth/get-session`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.user) {
        return {
          isAuthenticated: true,
          emailVerified: data.user.emailVerified ?? false,
        };
      }
    }
  } catch (error) {
    console.error("Error verifying session with backend:", error);
  }

  return { isAuthenticated: false, emailVerified: false };
}

/**
 * Main proxy function
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;
  const rawRedirect = searchParams.get("redirect");

  const base = (process.env.NEXT_PUBLIC_DASHBOARD_APP_URL as string) || "/";
  const safeRedirect = resolveSafeRedirect(rawRedirect, base);

  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return handleUnauthenticated(request, pathname, safeRedirect);
  }

  const { isAuthenticated, emailVerified } =
    await verifySessionWithBackend(request);

  if (!isAuthenticated) {
    return handleUnauthenticated(request, pathname, safeRedirect);
  }

  // Handle based on verification status
  return handleVerificationRedirects(request, pathname, emailVerified);
}

// proxy Config
export const proxyConfig = {
  matcher: [
    String.raw`/((?!api|_next/static|_next/image|favicon\.ico|.*\.png$).*)`,
  ],
};
