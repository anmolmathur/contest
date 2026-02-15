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

export async function POST(
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

    // Verify user is a judge for this contest
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json(
        { error: "Only judges can submit scores" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { submissionId, criteriaScores } = body;

    // Validate required fields
    if (!submissionId || !criteriaScores || typeof criteriaScores !== "object") {
      return NextResponse.json(
        { error: "submissionId and criteriaScores are required" },
        { status: 400 }
      );
    }

    // Validate all score values are 0-100
    const scoreEntries = Object.entries(criteriaScores) as [string, unknown][];
    for (const [key, value] of scoreEntries) {
      if (typeof value !== "number" || value < 0 || value > 100) {
        return NextResponse.json(
          {
            error: `Score for "${key}" must be a number between 0 and 100`,
          },
          { status: 400 }
        );
      }
    }

    // Verify submission exists and belongs to this contest
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        team: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.team?.contestId !== contest.id) {
      return NextResponse.json(
        { error: "Submission does not belong to this contest" },
        { status: 400 }
      );
    }

    // Extract legacy fields from criteriaScores for backward compatibility
    const legacyFields: Record<string, number | undefined> = {};
    for (const [criteriaKey, columnName] of Object.entries(LEGACY_FIELD_MAP)) {
      if (criteriaKey in criteriaScores) {
        legacyFields[columnName] = criteriaScores[criteriaKey] as number;
      }
    }

    // Check if judge already scored this submission
    const existingScore = await db.query.scores.findFirst({
      where: and(
        eq(scores.submissionId, submissionId),
        eq(scores.judgeId, session.user.id)
      ),
    });

    if (existingScore) {
      // Update existing score
      const [updatedScore] = await db
        .update(scores)
        .set({
          criteriaScores,
          ...legacyFields,
          updatedAt: new Date(),
        })
        .where(eq(scores.id, existingScore.id))
        .returning();

      return NextResponse.json(
        { message: "Score updated successfully", score: updatedScore },
        { status: 200 }
      );
    } else {
      // Create new score
      const [newScore] = await db
        .insert(scores)
        .values({
          submissionId,
          judgeId: session.user.id,
          criteriaScores,
          ...legacyFields,
        })
        .returning();

      return NextResponse.json(
        { message: "Score submitted successfully", score: newScore },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Score submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
