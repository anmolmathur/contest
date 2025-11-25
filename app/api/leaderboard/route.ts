import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, scores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SCORE_WEIGHTS, PHASE_WEIGHTS } from "@/lib/constants";

export async function GET() {
  try {
    // Get all teams
    const allTeams = await db.query.teams.findMany();

    const leaderboardData = await Promise.all(
      allTeams.map(async (team) => {
        // Get all submissions for this team
        const teamSubmissions = await db.query.submissions.findMany({
          where: eq(submissions.teamId, team.id),
          with: {
            scores: true,
          },
        });

        // Calculate scores by phase
        const phaseScores: Record<number, number> = {};

        for (const submission of teamSubmissions) {
          if (submission.scores.length === 0) continue;

          // Calculate average weighted score from all judges for this submission
          const avgWeightedScore =
            submission.scores.reduce((sum, score) => {
              const weightedScore =
                score.aiUsageScore * SCORE_WEIGHTS.aiUsage +
                score.businessImpactScore * SCORE_WEIGHTS.businessImpact +
                score.uxScore * SCORE_WEIGHTS.ux +
                score.innovationScore * SCORE_WEIGHTS.innovation +
                score.executionScore * SCORE_WEIGHTS.execution;
              return sum + weightedScore;
            }, 0) / submission.scores.length;

          // Store the best score for this phase
          if (
            !phaseScores[submission.phase] ||
            avgWeightedScore > phaseScores[submission.phase]
          ) {
            phaseScores[submission.phase] = avgWeightedScore;
          }
        }

        // Calculate total weighted score across phases
        let totalScore = 0;
        for (const phase of [1, 2, 3, 4]) {
          if (phaseScores[phase]) {
            totalScore +=
              phaseScores[phase] * PHASE_WEIGHTS[phase as keyof typeof PHASE_WEIGHTS];
          }
        }

        return {
          teamId: team.id,
          teamName: team.name,
          track: team.track,
          totalScore,
        };
      })
    );

    // Sort by total score descending
    leaderboardData.sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json({ leaderboard: leaderboardData }, { status: 200 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

