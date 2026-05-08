import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scores, submissions, teams } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { requireLegacyJudge, errorResponse } from "@/lib/legacy-auth";

export async function GET(req: NextRequest) {
  try {
    const az = await requireLegacyJudge();

    const { searchParams } = new URL(req.url);
    const judgeOnly = searchParams.get("judgeOnly") === "true";

    // Contest-scope: restrict to submissions belonging to teams in the default contest.
    const contestTeams = await db.query.teams.findMany({
      where: eq(teams.contestId, az.defaultContestId),
      columns: { id: true },
    });
    const teamIds = contestTeams.map((t) => t.id);
    if (teamIds.length === 0) return NextResponse.json({ scores: [] }, { status: 200 });

    const contestSubmissions = await db.query.submissions.findMany({
      where: inArray(submissions.teamId, teamIds),
      columns: { id: true },
    });
    const submissionIds = contestSubmissions.map((s) => s.id);
    if (submissionIds.length === 0) return NextResponse.json({ scores: [] }, { status: 200 });

    const whereClause = judgeOnly
      ? and(inArray(scores.submissionId, submissionIds), eq(scores.judgeId, az.userId))
      : inArray(scores.submissionId, submissionIds);

    const allScores = await db.query.scores.findMany({
      where: whereClause,
      with: {
        submission: { with: { team: true } },
        judge: true,
      },
    });

    const formattedScores = allScores.map((score) => ({
      id: score.id,
      submissionId: score.submissionId,
      judgeId: score.judgeId,
      judgeName: score.judge?.name || "Unknown",
      judgeEmail: score.judge?.email || "Unknown",
      teamId: score.submission?.teamId,
      teamName: score.submission?.team?.name || "Unknown",
      phase: score.submission?.phase,
      aiUsageScore: score.aiUsageScore,
      businessImpactScore: score.businessImpactScore,
      uxScore: score.uxScore,
      innovationScore: score.innovationScore,
      executionScore: score.executionScore,
      weightedScore: (
        (score.aiUsageScore ?? 0) * 0.35 +
        (score.businessImpactScore ?? 0) * 0.25 +
        (score.uxScore ?? 0) * 0.15 +
        (score.innovationScore ?? 0) * 0.1 +
        (score.executionScore ?? 0) * 0.15
      ).toFixed(2),
      createdAt: score.createdAt,
      updatedAt: score.updatedAt,
    }));

    return NextResponse.json({ scores: formattedScores }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
