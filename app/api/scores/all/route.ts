import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { JUDGE_EMAILS } from "@/lib/constants";
import { db } from "@/lib/db";
import { scores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a judge
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only judges can access this" },
        { status: 403 }
      );
    }

    // Check for judgeOnly query parameter
    const { searchParams } = new URL(req.url);
    const judgeOnly = searchParams.get("judgeOnly") === "true";

    // Get scores with related data
    let allScores;
    if (judgeOnly) {
      // Only get scores for the current judge
      allScores = await db.query.scores.findMany({
        where: eq(scores.judgeId, session.user.id),
        with: {
          submission: {
            with: {
              team: true,
            },
          },
          judge: true,
        },
      });
    } else {
      // Get all scores (for admin view)
      allScores = await db.query.scores.findMany({
        with: {
          submission: {
            with: {
              team: true,
            },
          },
          judge: true,
        },
      });
    }

    // Format the response
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
        score.aiUsageScore * 0.35 +
        score.businessImpactScore * 0.25 +
        score.uxScore * 0.15 +
        score.innovationScore * 0.1 +
        score.executionScore * 0.15
      ).toFixed(2),
      createdAt: score.createdAt,
      updatedAt: score.updatedAt,
    }));

    return NextResponse.json({ scores: formattedScores }, { status: 200 });
  } catch (error) {
    console.error("Get all scores error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
