import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scores, submissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireLegacyJudge, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

export async function POST(req: NextRequest) {
  try {
    const az = await requireLegacyJudge();
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is completed or archived; scoring is frozen");

    const body = await req.json();
    const {
      submissionId,
      aiUsageScore,
      businessImpactScore,
      uxScore,
      innovationScore,
      executionScore,
    } = body;

    if (
      !submissionId ||
      aiUsageScore === undefined ||
      businessImpactScore === undefined ||
      uxScore === undefined ||
      innovationScore === undefined ||
      executionScore === undefined
    ) {
      return NextResponse.json(
        { error: "All score fields are required" },
        { status: 400 }
      );
    }

    const scoresArray = [
      aiUsageScore,
      businessImpactScore,
      uxScore,
      innovationScore,
      executionScore,
    ];
    if (scoresArray.some((score) => score < 0 || score > 100)) {
      return NextResponse.json(
        { error: "Scores must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Tenant isolation: verify the submission belongs to the default contest
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: { team: true },
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.team?.contestId !== az.defaultContestId) {
      return NextResponse.json(
        { error: "Submission is not in your contest" },
        { status: 403 }
      );
    }

    const existingScore = await db.query.scores.findFirst({
      where: and(
        eq(scores.submissionId, submissionId),
        eq(scores.judgeId, az.userId)
      ),
    });

    if (existingScore) {
      const [updatedScore] = await db
        .update(scores)
        .set({
          aiUsageScore,
          businessImpactScore,
          uxScore,
          innovationScore,
          executionScore,
          updatedAt: new Date(),
        })
        .where(eq(scores.id, existingScore.id))
        .returning();

      return NextResponse.json(
        { message: "Score updated successfully", score: updatedScore },
        { status: 200 }
      );
    } else {
      const [newScore] = await db
        .insert(scores)
        .values({
          submissionId,
          judgeId: az.userId,
          aiUsageScore,
          businessImpactScore,
          uxScore,
          innovationScore,
          executionScore,
        })
        .returning();

      return NextResponse.json(
        { message: "Score submitted successfully", score: newScore },
        { status: 201 }
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}

