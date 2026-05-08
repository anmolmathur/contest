import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, contestUsers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { SCORE_WEIGHTS } from "@/lib/constants";
import { requireLegacyRead, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const az = await requireLegacyRead();
    const { submissionId } = await params;

    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: { scores: true, team: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.team?.contestId !== az.defaultContestId) {
      throw new LegacyAuthError(403, "Submission is not in your contest");
    }

    const cu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.userId, az.userId),
      ),
    });
    const isTeamMember = !!cu && cu.teamId === submission.teamId;

    if (!isTeamMember && !az.isJudge && !az.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Judge count from contest_users in the default contest
    const judgesInContest = await db.query.contestUsers.findMany({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        inArray(contestUsers.role, ["judge", "admin"]),
      ),
      columns: { userId: true },
    });
    const totalJudges = Math.max(judgesInContest.length, 1);

    const judgesScored = submission.scores.length;
    const isComplete = judgesScored >= totalJudges;

    let averageScore = 0;
    let breakdown = { aiUsage: 0, businessImpact: 0, ux: 0, innovation: 0, execution: 0 };

    if (judgesScored > 0) {
      const totals = submission.scores.reduce(
        (acc, score) => ({
          aiUsage: acc.aiUsage + (score.aiUsageScore ?? 0),
          businessImpact: acc.businessImpact + (score.businessImpactScore ?? 0),
          ux: acc.ux + (score.uxScore ?? 0),
          innovation: acc.innovation + (score.innovationScore ?? 0),
          execution: acc.execution + (score.executionScore ?? 0),
        }),
        { aiUsage: 0, businessImpact: 0, ux: 0, innovation: 0, execution: 0 }
      );

      breakdown = {
        aiUsage: totals.aiUsage / judgesScored,
        businessImpact: totals.businessImpact / judgesScored,
        ux: totals.ux / judgesScored,
        innovation: totals.innovation / judgesScored,
        execution: totals.execution / judgesScored,
      };

      averageScore =
        breakdown.aiUsage * SCORE_WEIGHTS.aiUsage +
        breakdown.businessImpact * SCORE_WEIGHTS.businessImpact +
        breakdown.ux * SCORE_WEIGHTS.ux +
        breakdown.innovation * SCORE_WEIGHTS.innovation +
        breakdown.execution * SCORE_WEIGHTS.execution;
    }

    return NextResponse.json({
      submissionId,
      phase: submission.phase,
      totalJudges,
      judgesScored,
      isComplete,
      averageScore,
      breakdown,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
