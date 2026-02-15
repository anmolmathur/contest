import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { JUDGE_EMAILS, SCORE_WEIGHTS, PHASE_MAX_POINTS, PRIZES } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only judges can access this endpoint
    if (!JUDGE_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get limit from query params (default to 5 for top 5 winners)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    // Get only approved teams with their members (including email and role)
    const allTeams = await db.query.teams.findMany({
      where: eq(teams.approved, true),
      with: {
        members: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
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
                (score.aiUsageScore ?? 0) * SCORE_WEIGHTS.aiUsage +
                (score.businessImpactScore ?? 0) * SCORE_WEIGHTS.businessImpact +
                (score.uxScore ?? 0) * SCORE_WEIGHTS.ux +
                (score.innovationScore ?? 0) * SCORE_WEIGHTS.innovation +
                (score.executionScore ?? 0) * SCORE_WEIGHTS.execution;
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
        const phaseScores: Record<number, number> = {};
        let totalScore = 0;

        for (const phase of [2, 3, 4]) {
          const maxPoints = PHASE_MAX_POINTS[phase as keyof typeof PHASE_MAX_POINTS] || 0;
          if (phaseWeightedScores[phase]) {
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
            email: member.email,
            role: member.role,
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

    // Add rank information and prize details
    const winners = leaderboardData.slice(0, limit).map((team, index) => ({
      ...team,
      rank: index + 1,
      rankLabel: PRIZES[index]?.rank || `${index + 1}th Place`,
      prizeAmount: PRIZES[index]?.amount || 0,
      prizeColor: PRIZES[index]?.color || "steel",
    }));

    return NextResponse.json({ winners }, { status: 200 });
  } catch (error) {
    console.error("Winners API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
