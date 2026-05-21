import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { SCORE_WEIGHTS, PHASE_MAX_POINTS } from "@/lib/constants";
import { getDefaultContest } from "@/lib/contest-auth";

/**
 * Public legacy leaderboard for the default contest.
 *
 * Contest-scoped: only teams belonging to the `isDefault=true` contest are
 * returned. The previous implementation pulled `teams.approved=true` across
 * ALL contests — this is the data-isolation fix for Milestone 1.
 */
export async function GET() {
  try {
    const contest = await getDefaultContest();
    if (!contest) {
      return NextResponse.json({ leaderboard: [] }, { status: 200 });
    }

    // Completed/archived contests remain publicly visible (historical results)
    // but we don't expose drafts.
    if (contest.status === "draft") {
      return NextResponse.json({ leaderboard: [] }, { status: 200 });
    }

    const allTeams = await db.query.teams.findMany({
      where: and(eq(teams.approved, true), eq(teams.contestId, contest.id)),
      with: {
        trackRef: { columns: { id: true, name: true } },
      },
    });

    const leaderboardData = await Promise.all(
      allTeams.map(async (team) => {
        const teamSubmissions = await db.query.submissions.findMany({
          where: eq(submissions.teamId, team.id),
          with: { scores: true },
        });

        // Members resolved via contest_users (not legacy users.teamId)
        const memberLinks = await db.query.contestUsers.findMany({
          where: and(
            eq(contestUsers.contestId, contest.id),
            eq(contestUsers.teamId, team.id),
          ),
          with: { user: { columns: { id: true, name: true } } },
        });
        const members = memberLinks.filter((m) => m.user).map((m) => ({
          id: m.user!.id,
          name: m.user!.name,
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
          track: team.trackRef?.name || team.track,
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
    return NextResponse.json({ leaderboard: leaderboardData }, { status: 200 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
