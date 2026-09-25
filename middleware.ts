import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { resolveHostToSlug, customDomainsEnabled } from "@/lib/tenant-resolver";
import { PLATFORM_THEME_SCOPE } from "@/lib/theme";

// Paths that are never rewritten onto a contest when served from a custom
// domain: they are platform-level (auth, APIs, platform console, assets).
const NO_REWRITE_PREFIXES = [
  "/c/",
  "/api/",
  "/platform",
  "/_next",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/post-login",
  "/.well-known",
];

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/post-login",
  "/api/auth",
  "/api/contests", // public contest listing (GET)
  "/api/tls-ask", // reverse-proxy verification hook (no auth)
  "/.well-known/contest-verify", // custom domain ownership check
];

// Contest landing / rules / results / agenda / showcase / stage are public
const CONTEST_PUBLIC = /^\/c\/[^/]+(\/rules|\/results|\/agenda|\/showcase|\/stage|\/problems|\/agents|\/playbook)?$/;
const CONTEST_API_PUBLIC = /^\/api\/contests\/[^/]+$/;
const TRACKS_API_PUBLIC = /^\/api\/c\/[^/]+\/tracks$/;
const LEADERBOARD_PUBLIC = /^\/api\/c\/[^/]+\/leaderboard$/;
const SHOWCASE_API_PUBLIC = /^\/api\/c\/[^/]+\/showcase$/;
const LIVE_API_PUBLIC = /^\/api\/c\/[^/]+\/live$/; // stage view polls this (GET only)
// Ideathon: Problem Bank, value meter, awards, agent registry, playbook PDFs (GET only)
const IDEATHON_API_PUBLIC = /^\/api\/c\/[^/]+\/(problems|impact-summary|awards|agents|playbook\/[a-z-]+\/pdf)$/;
const ASSISTANT_PUBLIC = /^\/api\/c\/[^/]+\/assistant$/; // contestant Q&A works before login

function isPublic(pathname: string, method: string): boolean {
  if (pathname === "/") return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (CONTEST_PUBLIC.test(pathname)) return true;
  if (method === "GET" && (CONTEST_API_PUBLIC.test(pathname) || TRACKS_API_PUBLIC.test(pathname))) return true;
  if (method === "GET" && (LEADERBOARD_PUBLIC.test(pathname) || SHOWCASE_API_PUBLIC.test(pathname))) return true;
  if (method === "GET" && LIVE_API_PUBLIC.test(pathname)) return true;
  if (method === "GET" && IDEATHON_API_PUBLIC.test(pathname)) return true;
  if (method === "POST" && ASSISTANT_PUBLIC.test(pathname)) return true;
  if (pathname.startsWith("/api/uploads/local/")) return true; // served files (unguessable ids)
  return false;
}

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // --- Custom domain: the whole app for one contest on its own host --------
  // Requests on a verified custom domain are transparently rewritten to
  // /c/[slug]/... so /, /dashboard, /rules etc. render that contest. Auth
  // still applies to the rewritten path.
  let effectivePath = pathname;
  let rewriteTo: URL | null = null;
  let hostSlug: string | null = null;
  if (customDomainsEnabled()) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const slug = await resolveHostToSlug(host);
    hostSlug = slug;
    if (slug && !NO_REWRITE_PREFIXES.some((p) => pathname.startsWith(p))) {
      effectivePath = `/c/${slug}${pathname === "/" ? "" : pathname}`;
      rewriteTo = new URL(`${effectivePath}${search ?? ""}`, req.url);
    }
  }

  if (!isPublic(effectivePath, req.method) && !isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Build the redirect from the host the request actually arrived on (a
    // contest's custom domain or the platform host), not a configured base URL.
    const fwdHost = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
    const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
    const loginUrl = fwdHost ? new URL(`${proto}://${fwdHost}/login`) : new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search ?? ""}`);
    return NextResponse.redirect(loginUrl);
  }

  // Tell the root layout which contest this page belongs to, so it can pick
  // the contest's light/dark theme server-side (see lib/theme.ts).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-theme-scope", themeScopeFor(effectivePath, req.nextUrl.searchParams, hostSlug));
  if (rewriteTo) return NextResponse.rewrite(rewriteTo, { request: { headers: requestHeaders } });
  return NextResponse.next({ request: { headers: requestHeaders } });
});

/** Contest slug for /c/<slug>/… (or the custom-domain contest), auth pages opened from a contest, else "platform". */
function themeScopeFor(path: string, params: URLSearchParams, hostSlug: string | null): string {
  const m = path.match(/^\/c\/([^/?#]+)/);
  if (m) return m[1];
  if (/^\/(login|register|forgot-password|reset-password)/.test(path)) {
    const cb = params.get("callbackUrl") ?? "";
    const fromCb = cb.match(/^\/c\/([^/?#]+)/);
    if (fromCb) return fromCb[1];
  }
  return hostSlug ?? PLATFORM_THEME_SCOPE;
}

export const config = {
  // Node.js runtime: the custom-domain lookup queries Postgres, which the Edge
  // runtime can't do (no TCP sockets).
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
