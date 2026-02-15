import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Get total count of teams for this contest
    const [teamCountResult] = await db
      .select({ count: count() })
      .from(teams)
      .where(eq(teams.contestId, contest.id));

    // Get count of approved teams for this contest
    const [approvedCountResult] = await db
      .select({ count: count() })
      .from(teams)
      .where(
        and(
          eq(teams.contestId, contest.id),
          eq(teams.approved, true),
        )
      );

    return NextResponse.json(
      {
        count: teamCountResult.count,
        approvedCount: approvedCountResult.count,
        maxTeams: contest.maxTeams,
        maxApprovedTeams: contest.maxApprovedTeams,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Team count error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
