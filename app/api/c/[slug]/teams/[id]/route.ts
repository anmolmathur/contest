import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, submissions, contestUsers, tracks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

// GET - Get team details with members
export async function GET(
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

    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, id), eq(teams.contestId, contest.id)),
      with: {
        trackRef: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get team members via contest_users for contest-scoped membership
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        department: users.department,
        participantRole: contestUsers.participantRole,
      })
      .from(contestUsers)
      .innerJoin(users, eq(contestUsers.userId, users.id))
      .where(
        and(
          eq(contestUsers.teamId, id),
          eq(contestUsers.contestId, contest.id),
        )
      );

    return NextResponse.json({ team, members }, { status: 200 });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update team name/trackId (creator or admin only, before submissions)
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

    const body = await req.json();
    const { name, trackId } = body;

    // Get the team (scoped to this contest)
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, id), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is creator or admin
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only team creator or admin can update the team" },
        { status: 403 }
      );
    }

    // Check if team has any submissions (only allow edits before submission for non-admins)
    if (!isAdmin) {
      const teamSubmissions = await db.query.submissions.findMany({
        where: eq(submissions.teamId, id),
      });

      if (teamSubmissions.length > 0) {
        return NextResponse.json(
          { error: "Cannot update team after submissions have been made" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined && name.trim() !== "") {
      updateData.name = name.trim();
    }

    if (trackId !== undefined) {
      // Validate the track belongs to this contest
      const track = await db.query.tracks.findFirst({
        where: and(eq(tracks.id, trackId), eq(tracks.contestId, contest.id)),
      });

      if (!track) {
        return NextResponse.json(
          { error: "Invalid track for this contest" },
          { status: 400 }
        );
      }
      updateData.trackId = trackId;
    }

    const [updatedTeam] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json({
      message: "Team updated successfully",
      team: updatedTeam,
    });
  } catch (error: any) {
    console.error("Update team error:", error);
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Team name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete team (creator or admin only, before submissions unless admin)
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

    // Get the team (scoped to this contest)
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, id), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is creator or admin
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only team creator or admin can delete the team" },
        { status: 403 }
      );
    }

    // Check if team has any submissions (only allow deletion before submission for non-admins)
    if (!isAdmin) {
      const teamSubmissions = await db.query.submissions.findMany({
        where: eq(submissions.teamId, id),
      });

      if (teamSubmissions.length > 0) {
        return NextResponse.json(
          { error: "Cannot delete team after submissions have been made" },
          { status: 400 }
        );
      }
    }

    // Clear team association from contest_users records
    await db
      .update(contestUsers)
      .set({ teamId: null })
      .where(
        and(
          eq(contestUsers.teamId, id),
          eq(contestUsers.contestId, contest.id),
        )
      );

    // Remove team association from users table (backward compat)
    await db
      .update(users)
      .set({ teamId: null })
      .where(eq(users.teamId, id));

    // Delete the team (cascade will handle submissions if any)
    await db.delete(teams).where(eq(teams.id, id));

    return NextResponse.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Delete team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
