import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest, getContestUser } from "@/lib/contest-auth";

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

    const body = await req.json();
    const { teamId, userId } = body;

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: teamId and userId" },
        { status: 400 }
      );
    }

    // Get the team (scoped to this contest)
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, teamId), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is a judge/admin (can set leader for any team)
    const isJudge = await canJudgeContest(session.user.id, contest.id, session.user.email ?? undefined);

    // If not a judge/admin, verify the requesting user is a member of the team
    if (!isJudge) {
      const requestingContestUser = await getContestUser(session.user.id, contest.id);
      if (!requestingContestUser || requestingContestUser.teamId !== teamId) {
        return NextResponse.json(
          { error: "You must be a team member to set the leader" },
          { status: 403 }
        );
      }
    }

    // Verify the new leader is a member of the team in this contest
    const newLeaderContestUser = await getContestUser(userId, contest.id);
    if (!newLeaderContestUser || newLeaderContestUser.teamId !== teamId) {
      return NextResponse.json(
        { error: "The selected user must be a team member" },
        { status: 400 }
      );
    }

    // Update the team's leader
    const [updatedTeam] = await db
      .update(teams)
      .set({ leaderId: userId, updatedAt: new Date() })
      .where(eq(teams.id, teamId))
      .returning();

    return NextResponse.json({
      message: "Team leader updated successfully",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Set leader error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
