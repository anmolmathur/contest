import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { JUDGE_EMAILS } from "@/lib/constants";
import { db } from "@/lib/db";
import { teams, submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a judge
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only judges can access this" },
        { status: 403 }
      );
    }

    // Get all teams
    const allTeams = await db.query.teams.findMany();

    // Get submissions for each team
    const teamsWithSubmissions = await Promise.all(
      allTeams.map(async (team) => {
        const teamSubmissions = await db.query.submissions.findMany({
          where: eq(submissions.teamId, team.id),
        });

        return {
          ...team,
          submissions: teamSubmissions,
        };
      })
    );

    return NextResponse.json({ teams: teamsWithSubmissions }, { status: 200 });
  } catch (error) {
    console.error("Get all teams error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

