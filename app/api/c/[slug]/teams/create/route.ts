import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, contestUsers, contests, tracks } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";

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

    // Check user is a participant in this contest (or admin)
    const contestUser = await getContestUser(session.user.id, contest.id);
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

    if (!contestUser && !isAdmin) {
      return NextResponse.json(
        { error: "You are not assigned to this contest" },
        { status: 403 }
      );
    }

    if (contestUser && contestUser.role !== "participant" && !isAdmin) {
      return NextResponse.json(
        { error: "Only participants can create teams" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, trackId } = body;

    if (!name || !trackId) {
      return NextResponse.json(
        { error: "Missing required fields: name and trackId" },
        { status: 400 }
      );
    }

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

    // Check if team count limit has been reached
    const [teamCountResult] = await db
      .select({ count: count() })
      .from(teams)
      .where(eq(teams.contestId, contest.id));

    if (teamCountResult.count >= contest.maxTeams) {
      return NextResponse.json(
        { error: `Maximum team limit (${contest.maxTeams}) reached for this contest` },
        { status: 400 }
      );
    }

    // Check if user already has a team in this contest (via contest_users.teamId)
    if (contestUser?.teamId) {
      return NextResponse.json(
        { error: "You are already in a team for this contest" },
        { status: 400 }
      );
    }

    // Create team (creator is also the initial leader)
    const [newTeam] = await db
      .insert(teams)
      .values({
        name: name.trim(),
        contestId: contest.id,
        trackId,
        createdBy: session.user.id,
        leaderId: session.user.id,
      })
      .returning();

    // Update the contest_users record for this user with the teamId
    if (contestUser) {
      await db
        .update(contestUsers)
        .set({ teamId: newTeam.id })
        .where(eq(contestUsers.id, contestUser.id));
    }

    // Also update users.teamId for backward compat
    await db
      .update(users)
      .set({ teamId: newTeam.id })
      .where(eq(users.id, session.user.id));

    return NextResponse.json(
      { message: "Team created successfully", team: newTeam },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Team creation error:", error);
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
