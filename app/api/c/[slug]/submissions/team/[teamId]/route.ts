import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, contests, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest, getContestUser } from "@/lib/contest-auth";

// GET - Get all submissions for a team in this contest
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, teamId } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Verify the team belongs to this contest
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, teamId),
        eq(teams.contestId, contest.id)
      ),
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found in this contest" },
        { status: 404 }
      );
    }

    // Check authorization: team member or judge
    const contestUser = await getContestUser(session.user.id, contest.id);
    const isTeamMember = contestUser?.teamId === teamId;
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );

    if (!isTeamMember && !isJudge) {
      return NextResponse.json(
        { error: "You can only view your own team's submissions, or you must be a judge" },
        { status: 403 }
      );
    }

    const teamSubmissions = await db.query.submissions.findMany({
      where: eq(submissions.teamId, teamId),
      with: {
        scores: isJudge
          ? {
              with: {
                judge: true,
              },
            }
          : undefined,
      },
      orderBy: (submissions, { asc }) => [asc(submissions.phase)],
    });

    return NextResponse.json(
      { submissions: teamSubmissions },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get team submissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
