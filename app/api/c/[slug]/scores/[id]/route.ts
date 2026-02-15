import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, scores, contests, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";

// Legacy fixed field keys that map to dedicated columns
const LEGACY_FIELD_MAP: Record<string, string> = {
  aiUsageScore: "aiUsageScore",
  businessImpactScore: "businessImpactScore",
  uxScore: "uxScore",
  innovationScore: "innovationScore",
  executionScore: "executionScore",
};

// GET - Get a specific score
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Verify user is a judge for this contest
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json(
        { error: "Only judges can access scores" },
        { status: 403 }
      );
    }

    const score = await db.query.scores.findFirst({
      where: eq(scores.id, id),
      with: {
        submission: {
          with: {
            team: true,
          },
        },
        judge: true,
      },
    });

    if (!score) {
      return NextResponse.json({ error: "Score not found" }, { status: 404 });
    }

    // Verify score belongs to a submission in this contest
    if (score.submission?.team?.contestId !== contest.id) {
      return NextResponse.json(
        { error: "Score not found in this contest" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      score: {
        id: score.id,
        submissionId: score.submissionId,
        judgeId: score.judgeId,
        judgeName: score.judge?.name,
        teamName: score.submission?.team?.name,
        phase: score.submission?.phase,
        aiUsageScore: score.aiUsageScore,
        businessImpactScore: score.businessImpactScore,
        uxScore: score.uxScore,
        innovationScore: score.innovationScore,
        executionScore: score.executionScore,
        criteriaScores: score.criteriaScores,
        createdAt: score.createdAt,
        updatedAt: score.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a specific score
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Verify user is a judge for this contest
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json(
        { error: "Only judges can update scores" },
        { status: 403 }
      );
    }

    // Check if score exists
    const existingScore = await db.query.scores.findFirst({
      where: eq(scores.id, id),
      with: {
        submission: {
          with: {
            team: true,
          },
        },
      },
    });

    if (!existingScore) {
      return NextResponse.json({ error: "Score not found" }, { status: 404 });
    }

    // Verify score belongs to a submission in this contest
    if (existingScore.submission?.team?.contestId !== contest.id) {
      return NextResponse.json(
        { error: "Score not found in this contest" },
        { status: 404 }
      );
    }

    // Ownership check: Only the judge who created the score can update it
    if (existingScore.judgeId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own scores" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { criteriaScores, aiUsageScore, businessImpactScore, uxScore, innovationScore, executionScore } = body;

    // Build update object
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Handle dynamic criteriaScores
    if (criteriaScores && typeof criteriaScores === "object") {
      // Validate all score values are 0-100
      const scoreEntries = Object.entries(criteriaScores) as [string, unknown][];
      for (const [key, value] of scoreEntries) {
        if (typeof value !== "number" || value < 0 || value > 100) {
          return NextResponse.json(
            { error: `Score for "${key}" must be a number between 0 and 100` },
            { status: 400 }
          );
        }
      }
      updateData.criteriaScores = criteriaScores;

      // Also update legacy fields if matching keys exist
      for (const [criteriaKey, columnName] of Object.entries(LEGACY_FIELD_MAP)) {
        if (criteriaKey in criteriaScores) {
          updateData[columnName] = criteriaScores[criteriaKey];
        }
      }
    }

    // Also support direct legacy field updates for backward compat
    if (aiUsageScore !== undefined) updateData.aiUsageScore = aiUsageScore;
    if (businessImpactScore !== undefined) updateData.businessImpactScore = businessImpactScore;
    if (uxScore !== undefined) updateData.uxScore = uxScore;
    if (innovationScore !== undefined) updateData.innovationScore = innovationScore;
    if (executionScore !== undefined) updateData.executionScore = executionScore;

    // Validate legacy score ranges
    const legacyScoresToValidate = [
      updateData.aiUsageScore,
      updateData.businessImpactScore,
      updateData.uxScore,
      updateData.innovationScore,
      updateData.executionScore,
    ].filter((s) => s !== undefined) as number[];

    if (legacyScoresToValidate.some((score) => score < 0 || score > 100)) {
      return NextResponse.json(
        { error: "Scores must be between 0 and 100" },
        { status: 400 }
      );
    }

    const [updatedScore] = await db
      .update(scores)
      .set(updateData)
      .where(eq(scores.id, id))
      .returning();

    return NextResponse.json({
      message: "Score updated successfully",
      score: updatedScore,
    });
  } catch (error) {
    console.error("Update score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific score
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Verify user is a judge for this contest
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json(
        { error: "Only judges can delete scores" },
        { status: 403 }
      );
    }

    // Check if score exists and belongs to this contest
    const score = await db.query.scores.findFirst({
      where: eq(scores.id, id),
      with: {
        submission: {
          with: {
            team: true,
          },
        },
      },
    });

    if (!score) {
      return NextResponse.json({ error: "Score not found" }, { status: 404 });
    }

    if (score.submission?.team?.contestId !== contest.id) {
      return NextResponse.json(
        { error: "Score not found in this contest" },
        { status: 404 }
      );
    }

    // Delete the score
    await db.delete(scores).where(eq(scores.id, id));

    return NextResponse.json({ message: "Score deleted successfully" });
  } catch (error) {
    console.error("Delete score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
