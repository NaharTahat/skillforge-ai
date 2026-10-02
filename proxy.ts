import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection based on the session cookie (no database access).
 * The authoritative check is requireUser() in layouts, pages and server actions.
 *
 * The token is only read here, never re-issued. (Auth.js's `auth()` wrapper
 * refreshes the cookie on every request; a request already in flight during
 * sign-out could then write the session cookie back after it was cleared.)
 */
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol;
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // Auth.js uses the "__Secure-" cookie prefix on HTTPS.
    secureCookie: protocol.startsWith("https"),
  });
  return Boolean(token?.sub);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isSignedIn = await hasValidSession(request);

  if (pathname.startsWith("/dashboard") && !isSignedIn) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PAGES.includes(pathname) && isSignedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
