import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireLegacyRead, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const az = await requireLegacyRead();
    const { teamId } = await params;

    // Tenant isolation: the team must be in the default contest.
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    if (!team) throw new LegacyAuthError(404, "Team not found");
    if (team.contestId !== az.defaultContestId) {
      throw new LegacyAuthError(403, "Team is not in your contest");
    }

    const teamSubmissions = await db.query.submissions.findMany({
      where: eq(submissions.teamId, teamId),
    });

    return NextResponse.json({ submissions: teamSubmissions }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
