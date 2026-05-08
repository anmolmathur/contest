/**
 * Legacy judging-sheet download. Transparently proxies to the per-contest
 * endpoint against the default contest (the one flagged `is_default=true`).
 * Kept separate so the legacy /judging page can just link to this fixed URL
 * without knowing which contest is currently the default.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireLegacyJudge, errorResponse } from "@/lib/legacy-auth";

export async function GET(req: NextRequest) {
  try {
    const az = await requireLegacyJudge();
    // Forward to the per-contest handler, preserving query params.
    const origin = req.nextUrl.origin;
    const qs = req.nextUrl.searchParams.toString();
    const url = `${origin}/api/c/${az.defaultContestSlug}/judging-sheet${qs ? `?${qs}` : ""}`;
    // We can't forward cookies via a server fetch in a Node route without
    // passing the headers, so just redirect — the browser carries the cookie.
    return NextResponse.redirect(url, 307);
  } catch (e) {
    return errorResponse(e);
  }
}
