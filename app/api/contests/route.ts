import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isPlatformAdmin } from "@/lib/contest-auth";
import { createContestFromPreset } from "@/lib/contest-create";
import { resolveHostToSlug } from "@/lib/tenant-resolver";

// GET /api/contests - List all contests (public)
// On a custom contest domain only that contest is listed, so a third party
// on their own domain never sees the other tenants.
export async function GET(req: NextRequest) {
  try {
    const hostSlug = await resolveHostToSlug(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
    const allContests = await db.query.contests.findMany({
      where: hostSlug ? eq(contests.slug, hostSlug) : undefined,
      columns: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        contestType: true,
        visibility: true,
        heroTitle: true,
        heroSubtitle: true,
        bannerImageUrl: true,
        startDate: true,
        endDate: true,
        registrationDeadline: true,
        createdAt: true,
        // Surfaced so the platform admin UI can show / edit them
        customDomain: true,
        customDomainVerifiedAt: true,
        isDefault: true,
      },
      orderBy: (contests, { desc }) => [desc(contests.createdAt)],
    });

    return NextResponse.json(allContests);
  } catch (error) {
    console.error("Error fetching contests:", error);
    return NextResponse.json({ error: "Failed to fetch contests" }, { status: 500 });
  }
}

// POST /api/contests - Create a new contest (platform admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await isPlatformAdmin(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Only platform admins can create contests" }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, description, status } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    // Validate slug format (lowercase, hyphens, no spaces)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ error: "Slug must be lowercase with hyphens only" }, { status: 400 });
    }

    // Check for duplicate slug
    const existing = await db.query.contests.findFirst({
      where: eq(contests.slug, slug),
    });
    if (existing) {
      return NextResponse.json({ error: "A contest with this slug already exists" }, { status: 409 });
    }

    const newContest = await createContestFromPreset({
      type: body.contestType ?? "hackathon",
      name,
      slug,
      createdBy: session.user.id,
      overrides: {
        description: description || null,
        status: status || "draft",
        heroTitle: body.heroTitle || name,
        heroSubtitle: body.heroSubtitle || undefined,
        heroCtaText: body.heroCtaText || undefined,
        bannerImageUrl: body.bannerImageUrl || null,
        rulesContent: body.rulesContent || null,
        eligibilityRules: body.eligibilityRules || undefined,
        teamStructureRules: body.teamStructureRules || undefined,
        deliverableRules: body.deliverableRules || undefined,
        scoringCriteria: body.scoringCriteria,
        phaseConfig: body.phaseConfig,
        prizes: body.prizes,
        roleConfig: body.roleConfig,
        submissionFields: body.submissionFields,
        scoringScale: body.scoringScale,
        terminology: body.terminology,
        settings: body.settings,
        agenda: body.agenda,
        speakers: body.speakers,
        faqConfig: body.faqConfig,
        maxTeams: body.maxTeams || undefined,
        maxApprovedTeams: body.maxApprovedTeams || undefined,
        maxTeamMembers: body.maxTeamMembers || undefined,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : null,
        tracks: Array.isArray(body.tracks) ? body.tracks : undefined,
      },
    });

    return NextResponse.json(newContest, { status: 201 });
  } catch (error) {
    console.error("Error creating contest:", error);
    return NextResponse.json({ error: "Failed to create contest" }, { status: 500 });
  }
}
