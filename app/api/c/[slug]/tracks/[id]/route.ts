import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tracks, contests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

// PUT /api/c/[slug]/tracks/[id] - Update a track (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const canAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canAdmin) {
      return NextResponse.json({ error: "Only contest admins can update tracks" }, { status: 403 });
    }

    // Verify the track belongs to this contest
    const existingTrack = await db.query.tracks.findFirst({
      where: and(eq(tracks.id, id), eq(tracks.contestId, contest.id)),
    });

    if (!existingTrack) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = ["name", "description", "icon", "sortOrder"];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db.update(tracks)
      .set(updateData)
      .where(and(eq(tracks.id, id), eq(tracks.contestId, contest.id)))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating track:", error);
    return NextResponse.json({ error: "Failed to update track" }, { status: 500 });
  }
}

// DELETE /api/c/[slug]/tracks/[id] - Delete a track (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const canAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canAdmin) {
      return NextResponse.json({ error: "Only contest admins can delete tracks" }, { status: 403 });
    }

    // Verify the track belongs to this contest
    const existingTrack = await db.query.tracks.findFirst({
      where: and(eq(tracks.id, id), eq(tracks.contestId, contest.id)),
    });

    if (!existingTrack) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    await db.delete(tracks).where(and(eq(tracks.id, id), eq(tracks.contestId, contest.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting track:", error);
    return NextResponse.json({ error: "Failed to delete track" }, { status: 500 });
  }
}
