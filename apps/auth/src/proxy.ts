import { resolveSafeRedirect } from "@repo/common/lib/redirect";
import type { User } from "better-auth";
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
 * Fetch user profile from the API
 */
async function fetchUser(sessionCookie: string): Promise<User | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/get-session`,
      {
        headers: {
          Cookie: `better-auth.session_token=${sessionCookie}`,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Extract user from the response structure
    return data.user || null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

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
 * Main proxy function
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;
  const rawRedirect = searchParams.get("redirect");

  const base = (process.env.NEXT_PUBLIC_DASHBOARD_APP_URL as string) || "/";
  const safeRedirect = resolveSafeRedirect(rawRedirect, base);

  const sessionCookie = getSessionCookie(request);

  // Check if user is explicitly logging out
  const isLogout = searchParams.get("logout") === "true";

  // Handle public routes when no token exists
  if (!sessionCookie) {
    // Redirect root path to sign-in
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Redirect protected routes to sign-in with redirect parameter
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

  // Attempt to get user profile
  const profile = await fetchUser(sessionCookie);

  // Try token rotation if profile fetch fails
  if (!profile) {
    // If user is logging out, allow access to sign-in page
    if (isLogout && isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // If we still don't have a profile, handle as unauthenticated
    // Redirect root path to sign-in
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Redirect protected routes to sign-in with redirect parameter
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

  // Handle based on verification status
  return handleVerificationRedirects(request, pathname, profile.emailVerified);
}

// proxy Config
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.png$).*)"],
};
