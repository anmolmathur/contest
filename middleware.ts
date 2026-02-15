import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/api/auth",
    "/api/contests", // public contest listing
  ];

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Contest landing pages and rules are public: /c/[slug] and /c/[slug]/rules
  const contestPublicPattern = /^\/c\/[^/]+(\/rules)?$/;
  const isContestPublicRoute = contestPublicPattern.test(pathname);

  // Public API: get contest by slug
  const contestApiPublicPattern = /^\/api\/contests\/[^/]+$/;
  const isContestApiPublic = contestApiPublicPattern.test(pathname) && req.method === "GET";

  // Public API: get tracks for a contest
  const tracksApiPublicPattern = /^\/api\/c\/[^/]+\/tracks$/;
  const isTracksApiPublic = tracksApiPublicPattern.test(pathname) && req.method === "GET";

  if (isPublicRoute || isContestPublicRoute || isContestApiPublic || isTracksApiPublic) {
    return NextResponse.next();
  }

  // If not authenticated and trying to access protected route
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
