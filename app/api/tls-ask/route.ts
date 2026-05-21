import { NextRequest, NextResponse } from "next/server";
import { resolveHostToSlug, customDomainsEnabled } from "@/lib/tenant-resolver";

/**
 * Reverse-proxy TLS authorization hook.
 *
 * Caddy's `on_demand_tls { ask ... }`, Cloudflare for SaaS, and similar
 * products call this endpoint before requesting a new certificate. We return
 * 200 iff `?host=X` is a verified custom domain in our DB, else 404.
 *
 * GET /api/tls-ask?host=foo.example.com
 */
export async function GET(req: NextRequest) {
  if (!customDomainsEnabled()) {
    return NextResponse.json({ ok: false, reason: "disabled" }, { status: 503 });
  }
  const host = req.nextUrl.searchParams.get("host");
  if (!host) {
    return NextResponse.json({ ok: false, reason: "missing host" }, { status: 400 });
  }
  const slug = await resolveHostToSlug(host);
  if (!slug) {
    return NextResponse.json({ ok: false, reason: "not authorized" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, slug }, { status: 200 });
}
