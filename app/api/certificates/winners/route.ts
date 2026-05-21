import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { SCORE_WEIGHTS, PHASE_MAX_POINTS, PRIZES } from "@/lib/constants";
import { requireLegacyJudge, errorResponse } from "@/lib/legacy-auth";

export async function GET(request: Request) {
  try {
    const az = await requireLegacyJudge();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    // Contest-scoped: only approved teams in the default contest.
    const allTeams = await db.query.teams.findMany({
      where: and(eq(teams.approved, true), eq(teams.contestId, az.defaultContestId)),
    });

    const leaderboardData = await Promise.all(
      allTeams.map(async (team) => {
        const teamSubmissions = await db.query.submissions.findMany({
          where: eq(submissions.teamId, team.id),
          with: { scores: true },
        });

        // Resolve members via contest_users (not the legacy users.teamId column)
        const memberLinks = await db.query.contestUsers.findMany({
          where: and(
            eq(contestUsers.contestId, az.defaultContestId),
            eq(contestUsers.teamId, team.id),
          ),
          with: { user: { columns: { id: true, name: true, email: true } } },
        });
        const members = memberLinks.filter((m) => m.user).map((m) => ({
          id: m.user!.id,
          name: m.user!.name,
          email: m.user!.email,
          role: m.participantRole,
          isLeader: m.user!.id === team.leaderId,
        }));

        const phaseWeightedScores: Record<number, number> = {};
        for (const submission of teamSubmissions) {
          if (submission.scores.length === 0) continue;
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
          if (
            !phaseWeightedScores[submission.phase] ||
            avgWeightedScore > phaseWeightedScores[submission.phase]
          ) {
            phaseWeightedScores[submission.phase] = avgWeightedScore;
          }
        }

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
          members,
          phaseScores: {
            phase2: phaseScores[2] || 0,
            phase3: phaseScores[3] || 0,
            phase4: phaseScores[4] || 0,
          },
          totalScore,
        };
      })
    );

    leaderboardData.sort((a, b) => b.totalScore - a.totalScore);

    const winners = leaderboardData.slice(0, limit).map((team, index) => ({
      ...team,
      rank: index + 1,
      rankLabel: PRIZES[index]?.rank || `${index + 1}th Place`,
      prizeAmount: PRIZES[index]?.amount || 0,
      prizeColor: PRIZES[index]?.color || "steel",
    }));

    return NextResponse.json({ winners }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
