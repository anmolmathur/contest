import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, scores, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SCORE_WEIGHTS, PHASE_MAX_POINTS } from "@/lib/constants";

export async function GET() {
  try {
    // Get only approved teams with their members
    const allTeams = await db.query.teams.findMany({
      where: eq(teams.approved, true),
      with: {
        members: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    const leaderboardData = await Promise.all(
      allTeams.map(async (team) => {
        // Get all submissions for this team
        const teamSubmissions = await db.query.submissions.findMany({
          where: eq(submissions.teamId, team.id),
          with: {
            scores: true,
          },
        });

        // Calculate scores by phase (weighted score 0-100)
        const phaseWeightedScores: Record<number, number> = {};

        for (const submission of teamSubmissions) {
          if (submission.scores.length === 0) continue;

          // Calculate average weighted score from all judges for this submission (0-100 scale)
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

          // Store the best weighted score for this phase
          if (
            !phaseWeightedScores[submission.phase] ||
            avgWeightedScore > phaseWeightedScores[submission.phase]
          ) {
            phaseWeightedScores[submission.phase] = avgWeightedScore;
          }
        }

        // Scale phase scores to their maximum points
        // Phase 2: 25 pts, Phase 3: 25 pts, Phase 4: 50 pts (Total: 100 pts)
        const phaseScores: Record<number, number> = {};
        let totalScore = 0;

        for (const phase of [2, 3, 4]) {
          const maxPoints = PHASE_MAX_POINTS[phase as keyof typeof PHASE_MAX_POINTS] || 0;
          if (phaseWeightedScores[phase]) {
            // Scale the 0-100 weighted score to the phase maximum
            const scaledScore = (phaseWeightedScores[phase] / 100) * maxPoints;
            phaseScores[phase] = scaledScore;
            totalScore += scaledScore;
          } else {
            phaseScores[phase] = 0;
          }
        }

        return {
          teamId: team.id,
          teamName: team.name,
          track: team.track,
          leaderId: team.leaderId,
          members: team.members.map((member) => ({
            id: member.id,
            name: member.name,
            isLeader: member.id === team.leaderId,
          })),
          phaseScores: {
            phase2: phaseScores[2] || 0,
            phase3: phaseScores[3] || 0,
            phase4: phaseScores[4] || 0,
          },
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

