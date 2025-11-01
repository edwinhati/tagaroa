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
  sessionCookie: string,
): Promise<T | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/get-session`,
      {
        headers: {
          Cookie: `better-auth.session_token=${sessionCookie}`,
        },
        // timeout to prevent hanging requests
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      console.warn(
        `Auth session fetch failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    // Extract user from the response structure
    return (data.user as T) || null;
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
  sessionCookie: string,
): Promise<UserWithRole | null> {
  return fetchUserSession<UserWithRole>(sessionCookie);
}

function redirectToAuth(
  req: NextRequest,
  authAppUrl: string,
  redirectUrl?: string,
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

// Shared proxy pre-checks
async function handleCommonProxyLogic(
  request: NextRequest,
  authAppUrl: string,
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
      "Detected potential redirect loop, clearing redirect parameter",
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

/* ----------------------- Dedup helpers & core ------------------------ */

function redirectAndClear(
  req: NextRequest,
  authAppUrl: string,
  redirect?: string,
) {
  const res = redirectToAuth(req, authAppUrl, redirect);
  return clearSessionCookie(res);
}

function isFromAuthAppRoot(
  req: NextRequest,
  authAppUrl: string,
  sessionCookie?: string,
) {
  const { pathname } = req.nextUrl;
  const referer = req.headers.get("referer");
  return (
    !!sessionCookie &&
    pathname === "/" &&
    !!referer &&
    referer.startsWith(authAppUrl)
  );
}

type ProxyCommonOpts<UserT extends User | UserWithRole> = {
  authAppUrl: string;
  verifyPath?: string;
  requireVerified?: boolean;

  // supply how to fetch the user (plain or with role)
  fetchUser: (sessionCookie: string) => Promise<UserT | null>;

  // role options (ignored if not provided)
  allowedRoles?: string[];
  requireAdmin?: boolean;
  redirectUrl?: string;

  // optional custom behavior after user is authorized
  onAuthorized?(
    user: UserT,
    req: NextRequest,
  ): NextResponse | null | undefined | Promise<NextResponse | null | undefined>;

  // whether to apply the "auth referer on /" pass-through
  honorAuthRefererOnRoot?: boolean;
};

async function proxyCommon<UserT extends User | UserWithRole>(
  request: NextRequest,
  opts: ProxyCommonOpts<UserT>,
) {
  const {
    authAppUrl,
    verifyPath = "/verify-email",
    requireVerified,
    fetchUser,
    allowedRoles,
    requireAdmin,
    redirectUrl,
    onAuthorized,
    honorAuthRefererOnRoot,
  } = opts;

  const { pathname } = request.nextUrl;
  const commonResult = await handleCommonProxyLogic(request, authAppUrl);

  if (commonResult.type === "next") return NextResponse.next();
  if (commonResult.type === "redirect")
    return NextResponse.redirect(commonResult.url);
  if (commonResult.type === "auth-redirect")
    return redirectToAuth(request, commonResult.url, commonResult.redirect);

  // Safety: if we just came from the auth app and we're on "/", let it pass
  if (
    honorAuthRefererOnRoot &&
    isFromAuthAppRoot(request, authAppUrl, commonResult.sessionCookie)
  ) {
    return NextResponse.next();
  }

  try {
    const user = await fetchUser(commonResult.sessionCookie);

    if (!user) {
      return redirectAndClear(
        request,
        authAppUrl,
        pathname === "/" ? undefined : request.nextUrl.href,
      );
    }

    if (requireVerified && !user.emailVerified) {
      return NextResponse.redirect(
        new URL(`${authAppUrl}${verifyPath}`, request.nextUrl),
      );
    }

    // Role policy (only if options provided)
    const needAdmin = !!requireAdmin;
    const hasAllowed =
      Array.isArray(allowedRoles) && allowedRoles.length > 0
        ? hasRole(user as UserWithRole, allowedRoles)
        : true;
    const isUserAdmin = "role" in user ? isAdmin(user as UserWithRole) : false;

    if ((needAdmin && !isUserAdmin) || !hasAllowed) {
      // custom redirect override
      if (redirectUrl) {
        return redirectToApp(request, redirectUrl);
      }

      // default role-aware redirect
      if (isUserAdmin) {
        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL as string;
        return redirectToApp(request, adminUrl);
      } else {
        const dashboardUrl =
          process.env.NEXT_PUBLIC_DASHBOARD_URL ||
          (process.env.NEXT_PUBLIC_MAIN_APP_URL as string);
        return redirectToApp(request, dashboardUrl);
      }
    }

    // Custom post-authorization behavior (e.g., send admins to admin app)
    if (onAuthorized) {
      const maybe = await onAuthorized(user, request);
      if (maybe) return maybe;
    }

    return NextResponse.next();
  } catch (error) {
    console.error(`Proxy error for ${pathname}:`, error);
    return redirectAndClear(
      request,
      authAppUrl,
      pathname === "/" ? undefined : request.nextUrl.href,
    );
  }
}

/* --------------------------- Public creators ------------------------- */

export function createAuthProxy(opts: Options) {
  const verifyPath = opts.verifyPath ?? "/verify-email";

  return async function proxy(request: NextRequest) {
    return proxyCommon<User>(request, {
      authAppUrl: opts.authAppUrl,
      verifyPath,
      requireVerified: true,
      fetchUser,
      // Additional safety to avoid loop on "/" after coming from auth
      honorAuthRefererOnRoot: true,
    });
  };
}

export function createRoleBasedProxy(opts: RoleBasedOptions) {
  const verifyPath = opts.verifyPath ?? "/verify-email";
  const allowedRoles =
    opts.allowedRoles ?? (opts.requireAdmin ? ["admin"] : []);

  return async function proxy(request: NextRequest) {
    return proxyCommon<UserWithRole>(request, {
      authAppUrl: opts.authAppUrl,
      verifyPath,
      requireVerified: true,
      fetchUser: fetchUserWithRole,
      allowedRoles,
      requireAdmin: opts.requireAdmin,
      redirectUrl: opts.redirectUrl,
    });
  };
}

export function createAdminProxy(opts: Omit<RoleBasedOptions, "requireAdmin">) {
  return createRoleBasedProxy({
    ...opts,
    requireAdmin: true,
  });
}

export function createBasicProxy(opts: Omit<RoleBasedOptions, "allowedRoles">) {
  const verifyPath = opts.verifyPath ?? "/verify-email";

  return async function proxy(request: NextRequest) {
    return proxyCommon<UserWithRole>(request, {
      authAppUrl: opts.authAppUrl,
      verifyPath,
      requireVerified: true,
      fetchUser: fetchUserWithRole,
      honorAuthRefererOnRoot: true,
      // If user is admin, send to admin app; otherwise proceed
      onAuthorized: async (user) => {
        if (isAdmin(user)) {
          const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL as string;
          return redirectToApp(request, adminUrl);
        }
        return null;
      },
    });
  };
}

/* ------------------------ Redirect utility API ----------------------- */

// Utility function for auth app to determine redirect based on user role
export async function getRedirectPathForUser(
  requestedRedirect?: string | null,
): Promise<string> {
  try {
    // This would typically be called from the auth app after successful login
    // We need to fetch the session to check the user's role
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/get-session`,
      {
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      },
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
