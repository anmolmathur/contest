import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { JUDGE_EMAILS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { teamId, userId } = body;

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the team
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is a judge (can set leader for any team)
    const isJudge = JUDGE_EMAILS.includes(session.user.email || "");

    // Verify the requesting user is a member of the team (if not a judge)
    if (!isJudge) {
      const requestingUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });

      if (requestingUser?.teamId !== teamId) {
        return NextResponse.json(
          { error: "You must be a team member to set the leader" },
          { status: 403 }
        );
      }
    }

    // Verify the new leader is also a member of the team
    const newLeader = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!newLeader || newLeader.teamId !== teamId) {
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

