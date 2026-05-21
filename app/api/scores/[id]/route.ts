import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireLegacyJudge, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

async function loadScopedScore(id: string, defaultContestId: string) {
  const score = await db.query.scores.findFirst({
    where: eq(scores.id, id),
    with: {
      submission: { with: { team: true } },
      judge: true,
    },
  });
  if (!score) throw new LegacyAuthError(404, "Score not found");
  if (score.submission?.team?.contestId !== defaultContestId) {
    throw new LegacyAuthError(403, "Score is not in your contest");
  }
  return score;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const az = await requireLegacyJudge();
    const { id } = await params;
    const score = await loadScopedScore(id, az.defaultContestId);

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
        createdAt: score.createdAt,
        updatedAt: score.updatedAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const az = await requireLegacyJudge();
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen");

    const { id } = await params;
    const body = await req.json();
    const { aiUsageScore, businessImpactScore, uxScore, innovationScore, executionScore } = body;

    const existingScore = await loadScopedScore(id, az.defaultContestId);
    if (existingScore.judgeId !== az.userId) {
      return NextResponse.json({ error: "You can only edit your own scores" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (aiUsageScore !== undefined) updateData.aiUsageScore = aiUsageScore;
    if (businessImpactScore !== undefined) updateData.businessImpactScore = businessImpactScore;
    if (uxScore !== undefined) updateData.uxScore = uxScore;
    if (innovationScore !== undefined) updateData.innovationScore = innovationScore;
    if (executionScore !== undefined) updateData.executionScore = executionScore;

    const scoresToValidate = [
      updateData.aiUsageScore,
      updateData.businessImpactScore,
      updateData.uxScore,
      updateData.innovationScore,
      updateData.executionScore,
    ].filter((s): s is number => typeof s === "number");

    if (scoresToValidate.some((score) => score < 0 || score > 100)) {
      return NextResponse.json({ error: "Scores must be between 0 and 100" }, { status: 400 });
    }

    const [updatedScore] = await db
      .update(scores)
      .set(updateData)
      .where(eq(scores.id, id))
      .returning();

    return NextResponse.json({ message: "Score updated successfully", score: updatedScore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const az = await requireLegacyJudge();
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen");

    const { id } = await params;
    await loadScopedScore(id, az.defaultContestId);
    await db.delete(scores).where(eq(scores.id, id));

    return NextResponse.json({ message: "Score deleted successfully" });
  } catch (error) {
    return errorResponse(error);
  }
}
