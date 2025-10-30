import { type User } from "better-auth";
import { type UserWithRole } from "better-auth/plugins/admin";

import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

type Options = {
  authAppUrl: string;
  verifyPath?: string; // default "/verify-email"
};

type RoleBasedOptions = {
  authAppUrl: string;
  verifyPath?: string; // default "/verify-email"
  allowedRoles?: string[]; // roles allowed to access this app
  redirectUrl?: string; // where to redirect unauthorized users
  requireAdmin?: boolean; // shorthand for admin-only access
};

async function fetchUserSession<T extends User = User>(
  sessionCookie: string
): Promise<T | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/get-session`,
      {
        headers: {
          Cookie: `better-auth.session_token=${sessionCookie}`,
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      console.warn(
        `Auth session fetch failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    // Extract user from the response structure
    return data.user || null;
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("Auth session fetch timeout");
    } else {
      console.error("Error fetching user profile:", error);
    }
    return null;
  }
}

async function fetchUser(sessionCookie: string): Promise<User | null> {
  return fetchUserSession<User>(sessionCookie);
}

async function fetchUserWithRole(
  sessionCookie: string
): Promise<UserWithRole | null> {
  return fetchUserSession<UserWithRole>(sessionCookie);
}

function redirectToAuth(
  req: NextRequest,
  authAppUrl: string,
  redirectUrl?: string
) {
  const url = new URL(authAppUrl, req.nextUrl);

  if (redirectUrl) {
    try {
      // Clean the redirect URL to prevent loops
      const cleanRedirectUrl = new URL(redirectUrl);
      // Remove any existing redirect parameters to prevent loops
      cleanRedirectUrl.searchParams.delete("redirect");

      // Only add redirect if it's not the same as the auth app URL
      const cleanUrl = cleanRedirectUrl.toString();
      if (!cleanUrl.startsWith(authAppUrl)) {
        url.searchParams.set("redirect", cleanUrl);
      }
    } catch (error) {
      console.warn(`Invalid redirect URL: ${redirectUrl}`, error);
    }
  }

  return NextResponse.redirect(url);
}

function redirectToApp(req: NextRequest, appUrl: string) {
  const url = new URL(appUrl, req.nextUrl);
  return NextResponse.redirect(url);
}

function hasRole(user: UserWithRole, allowedRoles: string[]): boolean {
  if (!user.role || allowedRoles.length === 0) return false;

  // Handle both string and array roles
  const userRoles = Array.isArray(user.role) ? user.role : [user.role];

  return allowedRoles.some((role) => userRoles.includes(role));
}

function isAdmin(user: UserWithRole): boolean {
  return hasRole(user, ["admin"]);
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set("better-auth.session_token", "", {
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return response;
}

// Shared proxy logic to reduce duplication
async function handleCommonProxyLogic(
  request: NextRequest,
  authAppUrl: string
) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip auth check for health checks and monitoring endpoints
  if (pathname === "/health" || pathname === "/ping") {
    return { type: "next" as const };
  }

  // Prevent redirect loops
  const redirectParam = searchParams.get("redirect");
  if (redirectParam && redirectParam.includes("redirect=")) {
    console.warn(
      "Detected potential redirect loop, clearing redirect parameter"
    );
    const cleanUrl = new URL(request.nextUrl);
    cleanUrl.searchParams.delete("redirect");
    return { type: "redirect" as const, url: cleanUrl };
  }

  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    if (pathname === "/") {
      return { type: "auth-redirect" as const, url: authAppUrl };
    }
    if (!pathname.startsWith("/_next")) {
      return {
        type: "auth-redirect" as const,
        url: authAppUrl,
        redirect: request.nextUrl.href,
      };
    }
    return { type: "auth-redirect" as const, url: authAppUrl };
  }

  return { type: "continue" as const, sessionCookie };
}

export function createAuthProxy(opts: Options) {
  const verifyPath = opts.verifyPath ?? "/verify-email";

  return async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const commonResult = await handleCommonProxyLogic(request, opts.authAppUrl);

    if (commonResult.type === "next") {
      return NextResponse.next();
    }

    if (commonResult.type === "redirect") {
      return NextResponse.redirect(commonResult.url);
    }

    if (commonResult.type === "auth-redirect") {
      return redirectToAuth(request, commonResult.url, commonResult.redirect);
    }

    // Additional safety: if we're coming from the auth app, don't redirect back immediately
    const referer = request.headers.get("referer");
    if (
      referer &&
      referer.startsWith(opts.authAppUrl) &&
      pathname === "/" &&
      commonResult.sessionCookie
    ) {
      return NextResponse.next();
    }

    try {
      const user = await fetchUser(commonResult.sessionCookie);

      if (!user) {
        const response = redirectToAuth(
          request,
          opts.authAppUrl,
          pathname === "/" ? undefined : request.nextUrl.href
        );
        return clearSessionCookie(response);
      }

      if (user.emailVerified) {
        return NextResponse.next();
      } else {
        return NextResponse.redirect(
          new URL(`${opts.authAppUrl}${verifyPath}`, request.nextUrl)
        );
      }
    } catch (error) {
      console.error(`Auth proxy error for ${pathname}:`, error);
      const response = redirectToAuth(
        request,
        opts.authAppUrl,
        pathname === "/" ? undefined : request.nextUrl.href
      );
      return clearSessionCookie(response);
    }
  };
}

export function createRoleBasedProxy(opts: RoleBasedOptions) {
  const verifyPath = opts.verifyPath ?? "/verify-email";
  const allowedRoles =
    opts.allowedRoles ?? (opts.requireAdmin ? ["admin"] : []);

  return async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const commonResult = await handleCommonProxyLogic(request, opts.authAppUrl);

    if (commonResult.type === "next") {
      return NextResponse.next();
    }

    if (commonResult.type === "redirect") {
      return NextResponse.redirect(commonResult.url);
    }

    if (commonResult.type === "auth-redirect") {
      return redirectToAuth(request, commonResult.url, commonResult.redirect);
    }

    try {
      const user = await fetchUserWithRole(commonResult.sessionCookie);

      if (!user) {
        const response = redirectToAuth(
          request,
          opts.authAppUrl,
          pathname === "/" ? undefined : request.nextUrl.href
        );
        return clearSessionCookie(response);
      }

      // Check if user's email is verified
      if (!user.emailVerified) {
        return NextResponse.redirect(
          new URL(`${opts.authAppUrl}${verifyPath}`, request.nextUrl)
        );
      }

      // Check role-based access
      if (allowedRoles.length > 0 && !hasRole(user, allowedRoles)) {
        if (opts.redirectUrl) {
          return redirectToApp(request, opts.redirectUrl);
        }

        // Default redirect logic based on role
        if (isAdmin(user)) {
          const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL as string;
          return redirectToApp(request, adminUrl);
        } else {
          const dashboardUrl =
            process.env.NEXT_PUBLIC_DASHBOARD_URL ||
            (process.env.NEXT_PUBLIC_MAIN_APP_URL as string);
          return redirectToApp(request, dashboardUrl);
        }
      }

      // User is authorized, allow access
      return NextResponse.next();
    } catch (error) {
      console.error(`Role-based proxy error for ${pathname}:`, error);
      const response = redirectToAuth(
        request,
        opts.authAppUrl,
        pathname === "/" ? undefined : request.nextUrl.href
      );
      return clearSessionCookie(response);
    }
  };
}

// Convenience functions for common use cases
export function createAdminProxy(opts: Omit<RoleBasedOptions, "requireAdmin">) {
  return createRoleBasedProxy({
    ...opts,
    requireAdmin: true,
  });
}

// Utility function for auth app to determine redirect based on user role
export async function getRedirectPathForUser(
  requestedRedirect?: string | null
): Promise<string> {
  try {
    // This would typically be called from the auth app after successful login
    // We need to fetch the session to check the user's role
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/get-session`,
      {
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      console.warn("Failed to fetch user session for redirect determination");
      return process.env.NEXT_PUBLIC_DASHBOARD_APP_URL as string;
    }

    const data = await response.json();
    const user = data.user as UserWithRole;

    if (!user) {
      return process.env.NEXT_PUBLIC_DASHBOARD_APP_URL as string;
    }

    // Check if user is admin
    const userIsAdmin = isAdmin(user);

    // If there's a requested redirect and it's valid, use it
    if (requestedRedirect) {
      try {
        const redirectUrl = new URL(requestedRedirect);
        const adminAppUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL as string;

        // Check if the redirect is to admin app
        const isAdminRedirect =
          redirectUrl.origin === new URL(adminAppUrl).origin;

        // Allow the redirect if:
        // - User is admin and redirect is to admin app
        // - User is not admin and redirect is not to admin app
        if (
          (userIsAdmin && isAdminRedirect) ||
          (!userIsAdmin && !isAdminRedirect)
        ) {
          return requestedRedirect;
        }
      } catch {
        console.warn("Invalid redirect URL:", requestedRedirect);
      }
    }

    // Default redirect based on role
    if (userIsAdmin) {
      return process.env.NEXT_PUBLIC_ADMIN_APP_URL as string;
    } else {
      return process.env.NEXT_PUBLIC_DASHBOARD_APP_URL as string;
    }
  } catch (error) {
    console.error("Error determining redirect path:", error);
    // Fallback to dashboard
    return process.env.NEXT_PUBLIC_DASHBOARD_APP_URL as string;
  }
}

export function createBasicProxy(opts: Omit<RoleBasedOptions, "allowedRoles">) {
  const verifyPath = opts.verifyPath ?? "/verify-email";

  return async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const commonResult = await handleCommonProxyLogic(request, opts.authAppUrl);

    if (commonResult.type === "next") {
      return NextResponse.next();
    }

    if (commonResult.type === "redirect") {
      return NextResponse.redirect(commonResult.url);
    }

    if (commonResult.type === "auth-redirect") {
      return redirectToAuth(request, commonResult.url, commonResult.redirect);
    }

    // Additional safety: if we're coming from the auth app, don't redirect back immediately
    const referer = request.headers.get("referer");
    if (
      referer &&
      referer.startsWith(opts.authAppUrl) &&
      pathname === "/" &&
      commonResult.sessionCookie
    ) {
      return NextResponse.next();
    }

    try {
      const user = await fetchUserWithRole(commonResult.sessionCookie);

      if (!user) {
        const response = redirectToAuth(
          request,
          opts.authAppUrl,
          pathname === "/" ? undefined : request.nextUrl.href
        );
        return clearSessionCookie(response);
      }

      // Check if user's email is verified
      if (!user.emailVerified) {
        return NextResponse.redirect(
          new URL(`${opts.authAppUrl}${verifyPath}`, request.nextUrl)
        );
      }

      // Check if user is admin - redirect to admin app
      if (isAdmin(user)) {
        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL as string;
        return redirectToApp(request, adminUrl);
      }
      return NextResponse.next();
    } catch (error) {
      console.error(`Dashboard proxy error for ${pathname}:`, error);
      const response = redirectToAuth(
        request,
        opts.authAppUrl,
        pathname === "/" ? undefined : request.nextUrl.href
      );
      return clearSessionCookie(response);
    }
  };
}
