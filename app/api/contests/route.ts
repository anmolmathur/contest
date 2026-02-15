import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isPlatformAdmin } from "@/lib/contest-auth";
import {
  DEFAULT_SCORING_CRITERIA,
  DEFAULT_PHASE_CONFIG,
  DEFAULT_PRIZES,
  DEFAULT_ROLE_CONFIG,
  DEFAULT_MAX_TEAMS,
  DEFAULT_MAX_APPROVED_TEAMS,
  DEFAULT_MAX_TEAM_MEMBERS,
} from "@/lib/constants";

// GET /api/contests - List all contests (public)
export async function GET() {
  try {
    const allContests = await db.query.contests.findMany({
      columns: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        heroTitle: true,
        heroSubtitle: true,
        bannerImageUrl: true,
        startDate: true,
        endDate: true,
        createdAt: true,
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

    const [newContest] = await db.insert(contests).values({
      name,
      slug,
      description: description || null,
      status: status || "draft",
      createdBy: session.user.id,
      heroTitle: body.heroTitle || name,
      heroSubtitle: body.heroSubtitle || description || "",
      heroCtaText: body.heroCtaText || "Register Now",
      bannerImageUrl: body.bannerImageUrl || null,
      rulesContent: body.rulesContent || null,
      eligibilityRules: body.eligibilityRules || null,
      teamStructureRules: body.teamStructureRules || null,
      deliverableRules: body.deliverableRules || null,
      scoringCriteria: body.scoringCriteria || DEFAULT_SCORING_CRITERIA,
      phaseConfig: body.phaseConfig || DEFAULT_PHASE_CONFIG,
      prizes: body.prizes || DEFAULT_PRIZES,
      roleConfig: body.roleConfig || DEFAULT_ROLE_CONFIG,
      maxTeams: body.maxTeams || DEFAULT_MAX_TEAMS,
      maxApprovedTeams: body.maxApprovedTeams || DEFAULT_MAX_APPROVED_TEAMS,
      maxTeamMembers: body.maxTeamMembers || DEFAULT_MAX_TEAM_MEMBERS,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    }).returning();

    return NextResponse.json(newContest, { status: 201 });
  } catch (error) {
    console.error("Error creating contest:", error);
    return NextResponse.json({ error: "Failed to create contest" }, { status: 500 });
  }
}
