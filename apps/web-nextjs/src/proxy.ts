import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  getRoleHome,
  isRouteAllowedForRole,
  verifySessionToken,
} from "@/libs/auth/session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/capture",
  "/patients",
  "/training-bench",
  "/devices",
  "/settings",
  "/notes",
  "/baseline-history",
  "/bench-history",
  "/admin",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? verifySessionToken(token) : null;

  // Root path routing
  if (pathname === "/") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(new URL(getRoleHome(user.role), request.url));
  }

  // Already logged in visiting login page
  if (pathname === "/login") {
    if (user) {
      return NextResponse.redirect(new URL(getRoleHome(user.role), request.url));
    }
    return NextResponse.next();
  }

  // Check protected clinic routes
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      if (token) loginUrl.searchParams.set("expired", "1");
      return NextResponse.redirect(loginUrl);
    }

    // Role-based restrictions (e.g. Interns cannot access patient data)
    if (!isRouteAllowedForRole(pathname, user.role)) {
      const homeUrl = new URL(getRoleHome(user.role), request.url);
      homeUrl.searchParams.set("forbidden", "1");
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
