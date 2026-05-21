import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { legacyAuthz, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

export async function POST(req: NextRequest) {
  try {
    const az = await legacyAuthz();
    if (!az.canRead) throw new LegacyAuthError(403, "No access to default contest");
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen");

    const body = await req.json();
    const { teamId, userId } = body;
    if (!teamId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.contestId !== az.defaultContestId) {
      throw new LegacyAuthError(403, "Team is not in your contest");
    }

    // Requester must be on the team (via contest_users) or a judge/admin.
    if (!az.isJudge) {
      const requester = await db.query.contestUsers.findFirst({
        where: and(
          eq(contestUsers.contestId, az.defaultContestId),
          eq(contestUsers.userId, az.userId),
        ),
      });
      if (!requester || requester.teamId !== teamId) {
        return NextResponse.json(
          { error: "You must be a team member to set the leader" },
          { status: 403 }
        );
      }
    }

    // New leader must also be on the team.
    const newLeader = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.userId, userId),
      ),
    });
    if (!newLeader || newLeader.teamId !== teamId) {
      return NextResponse.json(
        { error: "The selected user must be a team member" },
        { status: 400 }
      );
    }

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
    return errorResponse(error);
  }
}
