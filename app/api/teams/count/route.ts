import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { count, eq, and } from "drizzle-orm";
import { getDefaultContest } from "@/lib/contest-auth";

export async function GET() {
  try {
    const contest = await getDefaultContest();
    if (!contest) {
      return NextResponse.json({ count: 0, approvedCount: 0 }, { status: 200 });
    }

    const [teamCountResult] = await db
      .select({ count: count() })
      .from(teams)
      .where(eq(teams.contestId, contest.id));

    const [approvedCountResult] = await db
      .select({ count: count() })
      .from(teams)
      .where(and(eq(teams.contestId, contest.id), eq(teams.approved, true)));

    return NextResponse.json(
      { count: teamCountResult.count, approvedCount: approvedCountResult.count },
      { status: 200 }
    );
  } catch (error) {
    console.error("Team count error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
