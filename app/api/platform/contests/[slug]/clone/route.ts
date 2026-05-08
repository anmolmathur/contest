import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests, tracks, certificateTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isPlatformAdmin } from "@/lib/contest-auth";

/**
 * Clone a contest.
 *
 * What we copy: the `contests` row (minus id/slug/status/dates/isDefault/domain),
 * every `tracks` row, every `certificate_templates` row bound to this contest.
 *
 * What we explicitly DO NOT copy: `contest_users`, `teams`, `submissions`,
 * `scores`, `announcements`, `notifications`, `team_pitches` — those are
 * execution state from the previous run and must start empty.
 *
 * POST /api/platform/contests/[slug]/clone
 *   body: { newSlug: string; newName: string; shiftDatesByDays?: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isPlatformAdmin(session.user.id)))
    return NextResponse.json({ error: "Platform admin only" }, { status: 403 });

  const { slug: sourceSlug } = await params;
  const body = await req.json();
  const { newSlug, newName, shiftDatesByDays } = body as {
    newSlug?: string;
    newName?: string;
    shiftDatesByDays?: number;
  };

  if (!newSlug || !newName) {
    return NextResponse.json({ error: "newSlug and newName are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(newSlug)) {
    return NextResponse.json(
      { error: "newSlug must be lowercase letters, digits, and hyphens only" },
      { status: 400 }
    );
  }

  const source = await db.query.contests.findFirst({
    where: eq(contests.slug, sourceSlug),
    with: {
      tracks: true,
      certificateTemplates: true,
    },
  });
  if (!source) return NextResponse.json({ error: "Source contest not found" }, { status: 404 });

  const clash = await db.query.contests.findFirst({ where: eq(contests.slug, newSlug) });
  if (clash) return NextResponse.json({ error: "A contest with that slug already exists" }, { status: 409 });

  const shiftMs = (shiftDatesByDays ?? 0) * 24 * 60 * 60 * 1000;
  const shift = (d: Date | null) => (d ? new Date(d.getTime() + shiftMs) : null);

  // Shift date strings inside the phaseConfig jsonb, too.
  const phaseConfig = Array.isArray(source.phaseConfig)
    ? (source.phaseConfig as Array<Record<string, unknown>>).map((p) => {
        const s = typeof p.startDate === "string" && p.startDate ? new Date(p.startDate) : null;
        const e = typeof p.endDate === "string" && p.endDate ? new Date(p.endDate) : null;
        return {
          ...p,
          startDate: s ? new Date(s.getTime() + shiftMs).toISOString().slice(0, 10) : p.startDate,
          endDate: e ? new Date(e.getTime() + shiftMs).toISOString().slice(0, 10) : p.endDate,
        };
      })
    : source.phaseConfig;

  // Single transaction: insert contest row, clone tracks, clone cert templates.
  const result = await db.transaction(async (tx) => {
    const [newContest] = await tx
      .insert(contests)
      .values({
        name: newName,
        slug: newSlug,
        description: source.description,
        status: "draft",
        visibility: "public",
        isDefault: false,
        createdBy: session.user.id,
        heroTitle: newName, // default to name; admin can rewrite
        heroSubtitle: source.heroSubtitle,
        heroCtaText: source.heroCtaText,
        bannerImageUrl: source.bannerImageUrl,
        rulesContent: source.rulesContent,
        eligibilityRules: source.eligibilityRules,
        teamStructureRules: source.teamStructureRules,
        deliverableRules: source.deliverableRules,
        scoringCriteria: source.scoringCriteria,
        phaseConfig,
        prizes: source.prizes,
        roleConfig: source.roleConfig,
        brandingConfig: source.brandingConfig,
        featureFlags: source.featureFlags,
        faqConfig: source.faqConfig,
        supportEmail: source.supportEmail,
        maxTeams: source.maxTeams,
        maxApprovedTeams: source.maxApprovedTeams,
        maxTeamMembers: source.maxTeamMembers,
        startDate: shift(source.startDate),
        endDate: shift(source.endDate),
        registrationDeadline: shift(source.registrationDeadline),
      })
      .returning();

    // Clone tracks
    if (source.tracks.length > 0) {
      await tx.insert(tracks).values(
        source.tracks.map((t) => ({
          contestId: newContest.id,
          name: t.name,
          description: t.description,
          icon: t.icon,
          sortOrder: t.sortOrder,
        }))
      );
    }

    // Clone contest-scoped certificate templates (skip platform-wide templates
    // since those are already globally available).
    const scopedTemplates = source.certificateTemplates.filter((t) => t.contestId);
    if (scopedTemplates.length > 0) {
      await tx.insert(certificateTemplates).values(
        scopedTemplates.map((t) => ({
          name: t.name,
          isDefault: false,
          contestId: newContest.id,
          titleText: t.titleText,
          subtitleText: t.subtitleText,
          eventName: newName, // rebrand
          footerText: t.footerText,
          signatureName: t.signatureName,
          signatureTitle: t.signatureTitle,
          primaryLogoUrl: t.primaryLogoUrl,
          secondaryLogoUrl: t.secondaryLogoUrl,
          primaryColor: t.primaryColor,
          secondaryColor: t.secondaryColor,
          createdBy: session.user.id,
        }))
      );
    }

    return newContest;
  });

  return NextResponse.json(
    {
      ok: true,
      contest: result,
      message: `Cloned '${source.slug}' → '${result.slug}'. Contest is in DRAFT status. Configure and activate from the admin console.`,
    },
    { status: 201 }
  );
}
