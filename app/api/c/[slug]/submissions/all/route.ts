import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, scores, contests, contestUsers } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";

interface ScoringCriterion {
  name: string;
  key: string;
  weight: number;
  description?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Only judges/admins can access all submissions
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json(
        { error: "Only judges and admins can access all submissions" },
        { status: 403 }
      );
    }

    // Get all teams for this contest
    const contestTeams = await db.query.teams.findMany({
      where: eq(teams.contestId, contest.id),
      columns: { id: true },
    });

    const contestTeamIds = contestTeams.map((t) => t.id);

    if (contestTeamIds.length === 0) {
      return NextResponse.json({ submissions: [] }, { status: 200 });
    }

    // Get all submissions for teams in this contest
    const allSubmissions = await db.query.submissions.findMany({
      with: {
        team: true,
        scores: {
          with: {
            judge: true,
          },
        },
      },
      orderBy: (submissions, { desc }) => [desc(submissions.submittedAt)],
    });

    // Filter to only submissions from teams in this contest
    const contestSubmissions = allSubmissions.filter((s) =>
      contestTeamIds.includes(s.teamId)
    );

    // Count total judges for this contest
    const contestJudges = await db.query.contestUsers.findMany({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.role, "judge")
      ),
    });
    // Also count admins as potential judges
    const contestAdmins = await db.query.contestUsers.findMany({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.role, "admin")
      ),
    });
    const totalJudges = contestJudges.length + contestAdmins.length;

    // Format the response
    const formattedSubmissions = contestSubmissions.map((submission) => ({
      id: submission.id,
      teamId: submission.teamId,
      teamName: submission.team?.name || "Unknown",
      track: submission.team?.track || null,
      trackId: submission.team?.trackId || null,
      phase: submission.phase,
      githubUrl: submission.githubUrl,
      demoUrl: submission.demoUrl,
      submissionDescription: submission.submissionDescription,
      aiPromptsUsed: submission.aiPromptsUsed,
      aiToolsUtilized: submission.aiToolsUtilized,
      aiScreenshots: submission.aiScreenshots,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt,
      wasEdited:
        submission.updatedAt && submission.submittedAt
          ? new Date(submission.updatedAt).getTime() >
            new Date(submission.submittedAt).getTime() + 1000
          : false,
      scoresCount: submission.scores.length,
      totalJudges: totalJudges || 1,
      isFullyScored: submission.scores.length >= (totalJudges || 1),
    }));

    return NextResponse.json(
      { submissions: formattedSubmissions },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get all submissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
