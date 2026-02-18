import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, contestUsers, tracks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";

interface ScoringCriterion {
  name: string;
  key: string;
  weight: number;
  description?: string;
}

interface PhaseConfigEntry {
  phase: number;
  name: string;
  maxPoints: number;
}

interface Prize {
  rank: number;
  label: string;
  amount?: number | null;
  color: string;
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Only judges/admins can access winners
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    const scoringCriteria = (contest.scoringCriteria as ScoringCriterion[]) || [];
    const phaseConfig = (contest.phaseConfig as PhaseConfigEntry[]) || [];
    const prizes = (contest.prizes as Prize[]) || [];

    // Build phase maxPoints lookup from contest config
    const phaseMaxPoints: Record<number, number> = {};
    const scorablePhases: number[] = [];
    for (const pc of phaseConfig) {
      if (pc.maxPoints > 0) {
        phaseMaxPoints[pc.phase] = pc.maxPoints;
        scorablePhases.push(pc.phase);
      }
    }

    // Get approved teams for THIS contest with contest-scoped members
    const approvedTeams = await db.query.teams.findMany({
      where: and(
        eq(teams.contestId, contest.id),
        eq(teams.approved, true)
      ),
      with: {
        contestMembers: {
          where: eq(contestUsers.contestId, contest.id),
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        trackRef: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    const leaderboardData = await Promise.all(
      approvedTeams.map(async (team) => {
        // Get all submissions for this team
        const teamSubmissions = await db.query.submissions.findMany({
          where: eq(submissions.teamId, team.id),
          with: {
            scores: true,
          },
        });

        // Calculate scores by phase using dynamic criteria
        const phaseWeightedScores: Record<number, number> = {};

        for (const submission of teamSubmissions) {
          if (submission.scores.length === 0) continue;

          const avgWeightedScore =
            submission.scores.reduce((sum, score) => {
              const criteriaScoresData = score.criteriaScores as Record<string, number> | null;
              const weightedScore = calculateWeightedScore(criteriaScoresData, scoringCriteria);
              return sum + weightedScore;
            }, 0) / submission.scores.length;

          if (
            !phaseWeightedScores[submission.phase] ||
            avgWeightedScore > phaseWeightedScores[submission.phase]
          ) {
            phaseWeightedScores[submission.phase] = avgWeightedScore;
          }
        }

        // Scale phase scores to their maximum points
        const phaseScores: Record<string, number> = {};
        let totalScore = 0;

        for (const phase of scorablePhases) {
          const maxPoints = phaseMaxPoints[phase] || 0;
          if (phaseWeightedScores[phase]) {
            const scaledScore = (phaseWeightedScores[phase] / 100) * maxPoints;
            phaseScores[`phase${phase}`] = scaledScore;
            totalScore += scaledScore;
          } else {
            phaseScores[`phase${phase}`] = 0;
          }
        }

        // Track name from the tracks table
        const trackName = team.trackRef?.name || team.track || "N/A";

        return {
          teamId: team.id,
          teamName: team.name,
          track: trackName,
          leaderId: team.leaderId,
          members: team.contestMembers.map((cu) => ({
            id: cu.user?.id || "",
            name: cu.user?.name || null,
            email: cu.user?.email || null,
            role: cu.user?.role || null,
            isLeader: cu.user?.id === team.leaderId,
          })),
          phaseScores,
          totalScore,
        };
      })
    );

    // Sort by total score descending
    leaderboardData.sort((a, b) => b.totalScore - a.totalScore);

    // Add rank information from contest prizes config
    const winners = leaderboardData.slice(0, limit).map((team, index) => ({
      ...team,
      rank: index + 1,
      rankLabel: prizes[index]?.label || `${index + 1}th Place`,
      prizeAmount: prizes[index]?.amount || 0,
      prizeColor: (prizes[index]?.color || "steel") as "gold" | "silver" | "bronze" | "copper" | "steel",
    }));

    return NextResponse.json({ winners }, { status: 200 });
  } catch (error) {
    console.error("Contest winners API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
