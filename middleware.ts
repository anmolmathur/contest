import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { resolveHostToSlug, customDomainsEnabled } from "@/lib/tenant-resolver";

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // --- Custom domain tenant rewrite (Milestone 2) ---------------------------
  // If the request host is a verified custom domain, transparently rewrite the
  // URL so the app renders the right contest. Users see /dashboard, /rules,
  // etc. at their branded domain — internally we route to /c/[slug]/...
  if (customDomainsEnabled()) {
    const host = req.headers.get("host");
    const slug = await resolveHostToSlug(host);
    if (slug && !pathname.startsWith("/c/") && !pathname.startsWith("/api/") &&
        !pathname.startsWith("/platform") && !pathname.startsWith("/_next") &&
        !pathname.startsWith("/login") && !pathname.startsWith("/register")) {
      const rewritten = new URL(`/c/${slug}${pathname === "/" ? "" : pathname}${search ?? ""}`, req.url);
      return NextResponse.rewrite(rewritten);
    }
  }

  // --- Public route allowlist ----------------------------------------------
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/api/auth",
    "/api/contests", // public contest listing
    "/api/tls-ask",  // reverse-proxy verification hook (no auth)
    "/.well-known/contest-verify", // custom domain ownership check
  ];

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Contest landing / rules / results are public
  const contestPublicPattern = /^\/c\/[^/]+(\/rules|\/results)?$/;
  const isContestPublicRoute = contestPublicPattern.test(pathname);

  const contestApiPublicPattern = /^\/api\/contests\/[^/]+$/;
  const isContestApiPublic = contestApiPublicPattern.test(pathname) && req.method === "GET";

  const tracksApiPublicPattern = /^\/api\/c\/[^/]+\/tracks$/;
  const isTracksApiPublic = tracksApiPublicPattern.test(pathname) && req.method === "GET";

  // Public leaderboard for any contest
  const publicLeaderboardPattern = /^\/api\/c\/[^/]+\/leaderboard$/;
  const isPublicLeaderboard = publicLeaderboardPattern.test(pathname) && req.method === "GET";

  if (
    isPublicRoute ||
    isContestPublicRoute ||
    isContestApiPublic ||
    isTracksApiPublic ||
    isPublicLeaderboard
  ) {
    return NextResponse.next();
  }

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
