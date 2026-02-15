import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, scores, contests, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";

interface ScoringCriterion {
  name: string;
  key: string;
  weight: number;
  description?: string;
}

function calculateWeightedScore(
  criteriaScores: Record<string, number> | null | undefined,
  scoringCriteria: ScoringCriterion[]
): number {
  if (!criteriaScores || scoringCriteria.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const criterion of scoringCriteria) {
    const scoreValue = criteriaScores[criterion.key];
    if (scoreValue !== undefined && scoreValue !== null) {
      weightedSum += scoreValue * criterion.weight;
      totalWeight += criterion.weight;
    }
  }

  // Normalize if total weights don't sum to 1
  if (totalWeight > 0 && totalWeight !== 1) {
    return weightedSum / totalWeight;
  }

  return weightedSum;
}

export async function GET(
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
        { error: "Only judges can access scores" },
        { status: 403 }
      );
    }

    // Check for judgeOnly query parameter
    const { searchParams } = new URL(req.url);
    const judgeOnly = searchParams.get("judgeOnly") === "true";

    // Get all teams for this contest
    const contestTeams = await db.query.teams.findMany({
      where: eq(teams.contestId, contest.id),
      columns: { id: true },
    });
    const contestTeamIds = contestTeams.map((t) => t.id);

    if (contestTeamIds.length === 0) {
      return NextResponse.json({ scores: [] }, { status: 200 });
    }

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
      // Get all scores
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

    // Filter to only scores for submissions from teams in this contest
    const contestScores = allScores.filter(
      (s) =>
        s.submission?.team?.contestId === contest.id
    );

    const scoringCriteria = (contest.scoringCriteria as ScoringCriterion[]) || [];

    // Format the response
    const formattedScores = contestScores.map((score) => {
      const criteriaScoresData = score.criteriaScores as Record<string, number> | null;
      const weightedScore = calculateWeightedScore(criteriaScoresData, scoringCriteria);

      return {
        id: score.id,
        submissionId: score.submissionId,
        judgeId: score.judgeId,
        judgeName: score.judge?.name || "Unknown",
        judgeEmail: score.judge?.email || "Unknown",
        teamId: score.submission?.teamId,
        teamName: score.submission?.team?.name || "Unknown",
        phase: score.submission?.phase,
        // Legacy fixed fields
        aiUsageScore: score.aiUsageScore,
        businessImpactScore: score.businessImpactScore,
        uxScore: score.uxScore,
        innovationScore: score.innovationScore,
        executionScore: score.executionScore,
        // Dynamic criteria scores
        criteriaScores: criteriaScoresData,
        weightedScore: weightedScore.toFixed(2),
        createdAt: score.createdAt,
        updatedAt: score.updatedAt,
      };
    });

    return NextResponse.json({ scores: formattedScores }, { status: 200 });
  } catch (error) {
    console.error("Get all scores error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
