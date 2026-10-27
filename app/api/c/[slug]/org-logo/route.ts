import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { canAdminContest, resolveContest } from "@/lib/contest-auth";
import { isLogoUrl, LOGO_KEY, resolveLogo, type LogoSlot } from "@/lib/org-logo";

/**
 * Contest logos (brandingConfig.orgLogo / parentLogo). `?slot=parent` selects
 * the parent-company logo; default is the host organisation.
 * Merged into brandingConfig server-side so colours, wordmark etc. are kept.
 *
 * PUT    Body: { url: string, name?: string } -> { logo }
 * DELETE -> { logo: null }
 */
const slotOf = (req: NextRequest): LogoSlot =>
  req.nextUrl.searchParams.get("slot") === "parent" ? "parent" : "org";

async function authorise(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const contest = await resolveContest(slug);
  if (!contest) return { error: NextResponse.json({ error: "Contest not found" }, { status: 404 }) };
  if (!(await canAdminContest(session.user.id, contest.id))) {
    return { error: NextResponse.json({ error: "Only admins can change the logo" }, { status: 403 }) };
  }
  return { contest };
}

async function save(contestId: string, current: unknown, slot: LogoSlot, logo: { url: string; name: string } | null) {
  const next = { ...((current as Record<string, unknown> | null) ?? {}) };
  if (logo) next[LOGO_KEY[slot]] = logo;
  else delete next[LOGO_KEY[slot]];
  await db.update(contests).set({ brandingConfig: next, updatedAt: new Date() }).where(eq(contests.id, contestId));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorise(slug);
  if (a.error) return a.error;
  const body = (await req.json().catch(() => ({}))) as { url?: unknown; name?: unknown };
  if (!isLogoUrl(body.url)) {
    return NextResponse.json({ error: "Logo must be an http(s) URL or an uploaded file" }, { status: 400 });
  }
  const slot = slotOf(req);
  const logo = {
    url: body.url.trim(),
    name: typeof body.name === "string" ? body.name.trim().slice(0, 120) : "",
  };
  await save(a.contest.id, a.contest.brandingConfig, slot, logo);
  return NextResponse.json({ logo: resolveLogo({ [LOGO_KEY[slot]]: logo }, slot) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorise(slug);
  if (a.error) return a.error;
  await save(a.contest.id, a.contest.brandingConfig, slotOf(req), null);
  return NextResponse.json({ logo: null });
}
