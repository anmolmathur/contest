import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { JUDGE_EMAILS } from "@/lib/constants";
import { db } from "@/lib/db";
import { scores } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a judge
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only judges can submit scores" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      submissionId,
      aiUsageScore,
      businessImpactScore,
      uxScore,
      innovationScore,
      executionScore,
    } = body;

    // Validate required fields
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

    // Validate score ranges (0-100)
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
      // Create new score
      const [newScore] = await db
        .insert(scores)
        .values({
          submissionId,
          judgeId: session.user.id,
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
    console.error("Score submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

