import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";

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

    // Verify user is a judge or admin for this contest
    const canApprove = await canJudgeContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canApprove) {
      return NextResponse.json(
        { error: "Only judges and admins can approve teams" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { teamId, approved } = body;

    if (!teamId || typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: teamId and approved (boolean)" },
        { status: 400 }
      );
    }

    // Verify team belongs to this contest
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, teamId), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // If approving, check the approved teams limit for this contest
    if (approved) {
      const [approvedCountResult] = await db
        .select({ count: count() })
        .from(teams)
        .where(
          and(
            eq(teams.contestId, contest.id),
            eq(teams.approved, true),
          )
        );

      if (approvedCountResult.count >= contest.maxApprovedTeams) {
        return NextResponse.json(
          { error: `Maximum approved team limit (${contest.maxApprovedTeams}) reached for this contest` },
          { status: 400 }
        );
      }
    }

    // Update team approval status
    const [updatedTeam] = await db
      .update(teams)
      .set({
        approved,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    return NextResponse.json(
      {
        message: `Team ${approved ? "approved" : "unapproved"} successfully`,
        team: updatedTeam,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Team approval error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
