import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests, tracks, contestUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canAdminContest, isPlatformAdmin } from "@/lib/contest-auth";

// GET /api/contests/[slug] - Get a contest by slug (public)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const contest = await db.query.contests.findFirst({
      where: eq(contests.slug, slug),
      with: {
        tracks: {
          orderBy: (tracks, { asc }) => [asc(tracks.sortOrder)],
        },
      },
    });

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    return NextResponse.json(contest);
  } catch (error) {
    console.error("Error fetching contest:", error);
    return NextResponse.json({ error: "Failed to fetch contest" }, { status: 500 });
  }
}

// PUT /api/contests/[slug] - Update a contest (contest admin or platform admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const contest = await db.query.contests.findFirst({
      where: eq(contests.slug, slug),
    });

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const canAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canAdmin) {
      return NextResponse.json({ error: "Only contest admins can update contests" }, { status: 403 });
    }

    const body = await req.json();

    // Build update object from provided fields
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = [
      "name", "description", "status",
      "heroTitle", "heroSubtitle", "heroCtaText", "bannerImageUrl",
      "rulesContent", "eligibilityRules", "teamStructureRules", "deliverableRules",
      "scoringCriteria", "phaseConfig", "prizes", "roleConfig",
      "maxTeams", "maxApprovedTeams", "maxTeamMembers",
      "startDate", "endDate",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "startDate" || field === "endDate") {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Handle slug change separately (requires uniqueness check)
    if (body.slug && body.slug !== slug) {
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(body.slug)) {
        return NextResponse.json({ error: "Slug must be lowercase with hyphens only" }, { status: 400 });
      }
      const existing = await db.query.contests.findFirst({
        where: eq(contests.slug, body.slug),
      });
      if (existing) {
        return NextResponse.json({ error: "A contest with this slug already exists" }, { status: 409 });
      }
      updateData.slug = body.slug;
    }

    const [updated] = await db.update(contests)
      .set(updateData)
      .where(eq(contests.id, contest.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating contest:", error);
    return NextResponse.json({ error: "Failed to update contest" }, { status: 500 });
  }
}

// DELETE /api/contests/[slug] - Delete a contest (platform admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await isPlatformAdmin(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Only platform admins can delete contests" }, { status: 403 });
    }

    const { slug } = await params;

    const contest = await db.query.contests.findFirst({
      where: eq(contests.slug, slug),
    });

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    await db.delete(contests).where(eq(contests.id, contest.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contest:", error);
    return NextResponse.json({ error: "Failed to delete contest" }, { status: 500 });
  }
}
