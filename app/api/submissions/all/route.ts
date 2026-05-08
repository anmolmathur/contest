import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, teams, contestUsers } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { requireLegacyJudge, errorResponse } from "@/lib/legacy-auth";

export async function GET() {
  try {
    const az = await requireLegacyJudge();

    // Count judges from contest_users (not a hardcoded array length)
    const [judges, contestTeams] = await Promise.all([
      db.query.contestUsers.findMany({
        where: and(
          eq(contestUsers.contestId, az.defaultContestId),
          inArray(contestUsers.role, ["judge", "admin"]),
        ),
        columns: { userId: true },
      }),
      db.query.teams.findMany({
        where: eq(teams.contestId, az.defaultContestId),
        columns: { id: true },
      }),
    ]);
    const totalJudges = Math.max(judges.length, 1);
    const teamIds = contestTeams.map((t) => t.id);
    if (teamIds.length === 0) return NextResponse.json({ submissions: [] }, { status: 200 });

    const allSubmissions = await db.query.submissions.findMany({
      where: inArray(submissions.teamId, teamIds),
      with: { team: true, scores: { with: { judge: true } } },
      orderBy: (s, { desc }) => [desc(s.submittedAt)],
    });

    const formattedSubmissions = allSubmissions.map((submission) => ({
      id: submission.id,
      teamId: submission.teamId,
      teamName: submission.team?.name || "Unknown",
      track: submission.team?.track || "Unknown",
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
      totalJudges,
      isFullyScored: submission.scores.length >= totalJudges,
    }));

    return NextResponse.json({ submissions: formattedSubmissions }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
