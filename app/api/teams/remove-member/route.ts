import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, contestUsers, submissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { legacyAuthz, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

export async function POST(req: NextRequest) {
  try {
    const az = await legacyAuthz();
    if (!az.canRead) throw new LegacyAuthError(403, "No access to default contest");
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen");

    const body = await req.json();
    const { userId, teamId } = body;
    if (!userId || !teamId) {
      return NextResponse.json(
        { error: "Missing required fields: userId and teamId" },
        { status: 400 }
      );
    }

    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.contestId !== az.defaultContestId) {
      throw new LegacyAuthError(403, "Team is not in your contest");
    }

    const isCreator = team.createdBy === az.userId;
    if (!isCreator && !az.isJudge) {
      return NextResponse.json(
        { error: "Only team creator or admin can remove members" },
        { status: 403 }
      );
    }

    if (userId === team.createdBy) {
      return NextResponse.json(
        { error: "Cannot remove the team creator. Delete the team instead." },
        { status: 400 }
      );
    }

    if (!az.isJudge) {
      const teamSubmissions = await db.query.submissions.findMany({
        where: eq(submissions.teamId, teamId),
      });
      if (teamSubmissions.length > 0) {
        return NextResponse.json(
          { error: "Cannot remove members after submissions have been made" },
          { status: 400 }
        );
      }
    }

    // Verify membership via contest_users.
    const cu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.userId, userId),
      ),
    });
    if (!cu || cu.teamId !== teamId) {
      return NextResponse.json(
        { error: "User is not a member of this team" },
        { status: 400 }
      );
    }

    await db
      .update(contestUsers)
      .set({ teamId: null })
      .where(eq(contestUsers.id, cu.id));

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    return errorResponse(error);
  }
}
