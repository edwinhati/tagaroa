import type { User } from "better-auth";
import { getSessionCookie } from "better-auth/cookies";
import type { UserWithRole } from "better-auth/plugins/admin";
import { type NextRequest, NextResponse } from "next/server";

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
        // Increase timeout to 10 seconds to handle slow connections
        signal: AbortSignal.timeout(10000),
        // Don't cache the session check
        cache: "no-store",
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
  if (redirectParam?.includes("redirect=")) {
    console.warn(
      "Detected potential redirect loop, clearing redirect parameter",
    );
    const cleanUrl = new URL(request.nextUrl);
    cleanUrl.searchParams.delete("redirect");
    return { type: "redirect" as const, url: cleanUrl };
  }

  const sessionCookie = getSessionCookie(request);

  // Construct public URL for redirect (use x-forwarded-host or fallback to request URL)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
  const publicUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
    : request.nextUrl.href;

  if (!sessionCookie) {
    if (pathname === "/") {
      return { type: "auth-redirect" as const, url: authAppUrl };
    }
    if (!pathname.startsWith("/_next")) {
      return {
        type: "auth-redirect" as const,
        url: authAppUrl,
        redirect: publicUrl,
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

  const commonResult = await handleCommonProxyLogic(request, authAppUrl);
  const continuation = evaluateCommonResult(
    request,
    authAppUrl,
    honorAuthRefererOnRoot,
    commonResult,
  );
  if (continuation.kind === "response") {
    return continuation.response;
  }

  const userResult = await fetchUserOrRedirect(
    request,
    authAppUrl,
    continuation.sessionCookie,
    fetchUser,
  );
  if ("response" in userResult) {
    return userResult.response;
  }

  const verificationRedirect = enforceVerificationRequirement(
    request,
    authAppUrl,
    verifyPath,
    requireVerified,
    userResult.user,
  );
  if (verificationRedirect) {
    return verificationRedirect;
  }

  const roleRedirect = enforceRolePolicy(request, authAppUrl, userResult.user, {
    allowedRoles,
    requireAdmin,
    redirectUrl,
  });
  if (roleRedirect) {
    return roleRedirect;
  }

  if (onAuthorized) {
    const maybe = await onAuthorized(userResult.user, request);
    if (maybe) return maybe;
  }

  return NextResponse.next();
}

type CommonResult = Awaited<ReturnType<typeof handleCommonProxyLogic>>;

type ContinuationResult =
  | { kind: "response"; response: NextResponse }
  | { kind: "continue"; sessionCookie: string };

function evaluateCommonResult(
  request: NextRequest,
  authAppUrl: string,
  honorAuthRefererOnRoot: boolean | undefined,
  result: CommonResult,
): ContinuationResult {
  switch (result.type) {
    case "next":
      return { kind: "response", response: NextResponse.next() };
    case "redirect":
      return {
        kind: "response",
        response: NextResponse.redirect(result.url),
      };
    case "auth-redirect":
      return {
        kind: "response",
        response: redirectToAuth(request, result.url, result.redirect),
      };
    default:
      if (
        honorAuthRefererOnRoot &&
        isFromAuthAppRoot(request, authAppUrl, result.sessionCookie)
      ) {
        return { kind: "response", response: NextResponse.next() };
      }
      return { kind: "continue", sessionCookie: result.sessionCookie };
  }
}

type FetchUserOutcome<UserT> = { user: UserT } | { response: NextResponse };

async function fetchUserOrRedirect<UserT extends User | UserWithRole>(
  request: NextRequest,
  authAppUrl: string,
  sessionCookie: string,
  fetchUserFn: (cookie: string) => Promise<UserT | null>,
): Promise<FetchUserOutcome<UserT>> {
  try {
    const user = await fetchUserFn(sessionCookie);
    if (!user) {
      return {
        response: redirectAndClear(
          request,
          authAppUrl,
          computeRedirectTarget(request),
        ),
      };
    }
    return { user };
  } catch (error) {
    console.error(`Proxy error for ${request.nextUrl.pathname}:`, error);
    return {
      response: redirectAndClear(
        request,
        authAppUrl,
        computeRedirectTarget(request),
      ),
    };
  }
}

function computeRedirectTarget(request: NextRequest): string | undefined {
  if (request.nextUrl.pathname === "/") return undefined;

  // Construct public URL for redirect (use x-forwarded-host or fallback to request URL)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
  const { pathname, searchParams } = request.nextUrl;

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  }
  return request.nextUrl.href;
}

function enforceVerificationRequirement(
  request: NextRequest,
  authAppUrl: string,
  verifyPath: string,
  requireVerified: boolean | undefined,
  user: User | UserWithRole,
): NextResponse | null {
  if (!requireVerified || user.emailVerified) {
    return null;
  }
  return NextResponse.redirect(
    new URL(`${authAppUrl}${verifyPath}`, request.nextUrl),
  );
}

type RolePolicyOptions = Pick<
  ProxyCommonOpts<UserWithRole>,
  "allowedRoles" | "requireAdmin" | "redirectUrl"
>;

function enforceRolePolicy(
  request: NextRequest,
  authAppUrl: string,
  user: User | UserWithRole,
  options: RolePolicyOptions,
): NextResponse | null {
  const { allowedRoles, requireAdmin, redirectUrl } = options;
  const needsRoles =
    !!requireAdmin || (Array.isArray(allowedRoles) && allowedRoles.length > 0);

  if (!needsRoles || !("role" in user)) {
    return null;
  }

  const hasAllowed =
    Array.isArray(allowedRoles) && allowedRoles.length > 0
      ? hasRole(user, allowedRoles)
      : true;
  const adminRequired = !!requireAdmin;
  const isUserAdmin = isAdmin(user);

  if ((adminRequired && !isUserAdmin) || !hasAllowed) {
    if (redirectUrl) {
      return redirectToApp(request, redirectUrl);
    }
    return redirectToApp(
      request,
      resolveDefaultRoleRedirect(isUserAdmin, authAppUrl),
    );
  }

  return null;
}

function resolveDefaultRoleRedirect(
  isAdminUser: boolean,
  authAppUrl: string,
): string {
  if (isAdminUser) {
    return process.env.NEXT_PUBLIC_ADMIN_APP_URL || authAppUrl;
  }
  return (
    process.env.NEXT_PUBLIC_DASHBOARD_URL ||
    process.env.NEXT_PUBLIC_DASHBOARD_APP_URL ||
    process.env.NEXT_PUBLIC_MAIN_APP_URL ||
    authAppUrl
  );
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
