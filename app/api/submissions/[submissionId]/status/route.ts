import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, scores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { JUDGE_EMAILS, SCORE_WEIGHTS } from "@/lib/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { submissionId } = await params;

    // Get submission with scores
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        scores: true,
        team: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Check if user is authorized to view this status
    // (Either team member or judge)
    const isTeamMember = session.user.teamId === submission.teamId;
    const isJudge = JUDGE_EMAILS.includes(session.user.email || "");

    if (!isTeamMember && !isJudge) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const totalJudges = JUDGE_EMAILS.length;
    const judgesScored = submission.scores.length;
    const isComplete = judgesScored === totalJudges;

    // Calculate average scores if any exist
    let averageScore = 0;
    let breakdown = {
      aiUsage: 0,
      businessImpact: 0,
      ux: 0,
      innovation: 0,
      execution: 0,
    };

    if (judgesScored > 0) {
      const totals = submission.scores.reduce(
        (acc, score) => ({
          aiUsage: acc.aiUsage + score.aiUsageScore,
          businessImpact: acc.businessImpact + score.businessImpactScore,
          ux: acc.ux + score.uxScore,
          innovation: acc.innovation + score.innovationScore,
          execution: acc.execution + score.executionScore,
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

      // Calculate weighted average
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
    console.error("Submission status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

