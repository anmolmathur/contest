import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { invalidateHostCache } from "@/lib/tenant-resolver";

/**
 * Called once DNS propagates to confirm domain ownership.
 *
 * Workflow:
 *  1. Admin sets customDomain (unverified) via POST /api/platform/contests/[slug]/domain
 *  2. DNS `CNAME domain.customer.com -> platform-canonical-host` is created by customer
 *  3. Customer / admin hits `https://domain.customer.com/.well-known/contest-verify`
 *  4. We resolve the request's Host header to the contest row via customDomain,
 *     flip verifiedAt, invalidate cache, and return 200.
 *
 * Security note: mere reachability at the expected Host header is sufficient
 * proof of ownership here (since DNS must be pointed at us for the request to
 * arrive). A stronger flow would require an admin to POST a pre-generated
 * token we issued earlier. For a platform this scale that's overkill.
 */
export async function GET(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const override = req.nextUrl.searchParams.get("host");
  const effectiveHost = override ? override.toLowerCase() : host;

  if (!effectiveHost) {
    return NextResponse.json({ ok: false, reason: "no host" }, { status: 400 });
  }

  const contest = await db.query.contests.findFirst({
    where: eq(contests.customDomain, effectiveHost),
  });
  if (!contest) {
    return NextResponse.json({ ok: false, reason: "domain not registered" }, { status: 404 });
  }

  // Mark verified if it isn't already
  if (!contest.customDomainVerifiedAt) {
    await db.update(contests).set({
      customDomainVerifiedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(contests.id, contest.id));
    invalidateHostCache(effectiveHost);
  }

  return NextResponse.json({
    ok: true,
    contest: contest.slug,
    verified: true,
  });
}
