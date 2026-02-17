import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tracks, contests } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

// GET /api/c/[slug]/tracks - List all tracks for a contest (public)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const contestTracks = await db.query.tracks.findMany({
      where: eq(tracks.contestId, contest.id),
      orderBy: (tracks, { asc }) => [asc(tracks.sortOrder)],
    });

    return NextResponse.json(contestTracks);
  } catch (error) {
    console.error("Error fetching tracks:", error);
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 });
  }
}

// POST /api/c/[slug]/tracks - Create a track for a contest (admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const canAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canAdmin) {
      return NextResponse.json({ error: "Only contest admins can create tracks" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, icon, sortOrder } = body;

    if (!name) {
      return NextResponse.json({ error: "Track name is required" }, { status: 400 });
    }

    // Auto-assign next sortOrder if not provided
    let effectiveSortOrder = sortOrder;
    if (effectiveSortOrder === undefined || effectiveSortOrder === null) {
      const [maxResult] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${tracks.sortOrder}), -1)` })
        .from(tracks)
        .where(eq(tracks.contestId, contest.id));
      effectiveSortOrder = (maxResult?.maxOrder ?? -1) + 1;
    }

    const [newTrack] = await db.insert(tracks).values({
      contestId: contest.id,
      name,
      description: description || null,
      icon: icon || null,
      sortOrder: effectiveSortOrder,
    }).returning();

    return NextResponse.json(newTrack, { status: 201 });
  } catch (error) {
    console.error("Error creating track:", error);
    return NextResponse.json({ error: "Failed to create track" }, { status: 500 });
  }
}
