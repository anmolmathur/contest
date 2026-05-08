import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isPlatformAdmin } from "@/lib/contest-auth";
import { invalidateHostCache } from "@/lib/tenant-resolver";

/**
 * Platform-admin-only endpoints for managing a contest's custom domain.
 *
 * POST   /api/platform/contests/[slug]/domain   — set or change the pending domain
 * PATCH  /api/platform/contests/[slug]/domain   — verify the domain (admin override)
 * DELETE /api/platform/contests/[slug]/domain   — remove the domain
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isPlatformAdmin(session.user.id)))
    return NextResponse.json({ error: "Platform admin only" }, { status: 403 });

  const { slug } = await params;
  const { domain } = (await req.json()) as { domain?: string };
  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "domain required" }, { status: 400 });
  }
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const contest = await db.query.contests.findFirst({ where: eq(contests.slug, slug) });
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  // Uniqueness check
  const clash = await db.query.contests.findFirst({ where: eq(contests.customDomain, normalized) });
  if (clash && clash.id !== contest.id) {
    return NextResponse.json({ error: "Domain already bound to another contest" }, { status: 409 });
  }

  await db.update(contests).set({
    customDomain: normalized,
    customDomainVerifiedAt: null,
    updatedAt: new Date(),
  }).where(eq(contests.id, contest.id));

  invalidateHostCache(contest.customDomain ?? null);
  invalidateHostCache(normalized);

  return NextResponse.json({
    ok: true,
    domain: normalized,
    instructions: {
      cname: process.env.PLATFORM_CANONICAL_HOST ?? "hackathon.teamleaseedtech.com",
      verifyUrl: `/.well-known/contest-verify?host=${normalized}`,
    },
  });
}

/** PATCH: mark the domain as verified (admin forces verification). */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isPlatformAdmin(session.user.id)))
    return NextResponse.json({ error: "Platform admin only" }, { status: 403 });

  const { slug } = await params;
  const contest = await db.query.contests.findFirst({ where: eq(contests.slug, slug) });
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (!contest.customDomain)
    return NextResponse.json({ error: "No domain pending" }, { status: 400 });

  await db.update(contests).set({
    customDomainVerifiedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(contests.id, contest.id));

  invalidateHostCache(contest.customDomain);

  return NextResponse.json({ ok: true, verified: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isPlatformAdmin(session.user.id)))
    return NextResponse.json({ error: "Platform admin only" }, { status: 403 });

  const { slug } = await params;
  const contest = await db.query.contests.findFirst({ where: eq(contests.slug, slug) });
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  invalidateHostCache(contest.customDomain ?? null);

  await db.update(contests).set({
    customDomain: null,
    customDomainVerifiedAt: null,
    updatedAt: new Date(),
  }).where(eq(contests.id, contest.id));

  return NextResponse.json({ ok: true });
}
