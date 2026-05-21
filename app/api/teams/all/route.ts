import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireLegacyJudge, errorResponse } from "@/lib/legacy-auth";

export async function GET() {
  try {
    const az = await requireLegacyJudge();

    // Contest-scoped: only teams in the default contest
    const teamsWithData = await db.query.teams.findMany({
      where: eq(teams.contestId, az.defaultContestId),
      with: {
        members: {
          columns: { id: true, name: true, email: true, role: true },
        },
        submissions: true,
      },
    });

    return NextResponse.json({ teams: teamsWithData }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
