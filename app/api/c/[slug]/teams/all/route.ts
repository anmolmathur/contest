import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";

export async function GET(
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

    // Verify user is a judge or admin for this contest
    const canView = await canJudgeContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canView) {
      return NextResponse.json(
        { error: "Only judges and admins can access all teams" },
        { status: 403 }
      );
    }

    // Get all teams for this contest with their members and submissions
    const teamsWithData = await db.query.teams.findMany({
      where: eq(teams.contestId, contest.id),
      with: {
        members: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        contestMembers: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        submissions: true,
        trackRef: true,
      },
    });

    return NextResponse.json({ teams: teamsWithData }, { status: 200 });
  } catch (error) {
    console.error("Get all teams error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
