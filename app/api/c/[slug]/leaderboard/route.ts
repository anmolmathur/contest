import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, submissions, scores, contests, contestUsers } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";

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
  startDate?: string;
  endDate?: string;
  description?: string;
  details?: string[];
  deliverables?: string[];
}

/**
 * Calculate weighted score from dynamic criteria scores.
 * Returns a 0-100 scale score based on the contest's scoring criteria weights.
 */
function calculateWeightedScore(
  criteriaScoresData: Record<string, number> | null | undefined,
  scoringCriteria: ScoringCriterion[]
): number {
  if (!criteriaScoresData || scoringCriteria.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const criterion of scoringCriteria) {
    const scoreValue = criteriaScoresData[criterion.key];
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

    const scoringCriteria = (contest.scoringCriteria as ScoringCriterion[]) || [];
    const phaseConfig = (contest.phaseConfig as PhaseConfigEntry[]) || [];

    // Build phase maxPoints lookup from contest config
    const phaseMaxPoints: Record<number, number> = {};
    const scorablePhases: number[] = [];
    for (const pc of phaseConfig) {
      if (pc.maxPoints > 0) {
        phaseMaxPoints[pc.phase] = pc.maxPoints;
        scorablePhases.push(pc.phase);
      }
    }

    // Get only approved teams for this contest with their members
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
              },
            },
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

        // Calculate scores by phase (weighted score 0-100)
        const phaseWeightedScores: Record<number, number> = {};

        for (const submission of teamSubmissions) {
          if (submission.scores.length === 0) continue;

          // Calculate average weighted score from all judges for this submission (0-100 scale)
          const avgWeightedScore =
            submission.scores.reduce((sum, score) => {
              const criteriaScoresData = score.criteriaScores as Record<string, number> | null;
              const weightedScore = calculateWeightedScore(
                criteriaScoresData,
                scoringCriteria
              );
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

        for (const phase of scorablePhases) {
          const maxPoints = phaseMaxPoints[phase] || 0;
          if (phaseWeightedScores[phase]) {
            // Scale the 0-100 weighted score to the phase maximum
            const scaledScore =
              (phaseWeightedScores[phase] / 100) * maxPoints;
            phaseScores[phase] = scaledScore;
            totalScore += scaledScore;
          } else {
            phaseScores[phase] = 0;
          }
        }

        // Build members list from contest-scoped membership
        const members = team.contestMembers.map((cu) => ({
          id: cu.user?.id,
          name: cu.user?.name,
          isLeader: cu.user?.id === team.leaderId,
        }));

        // Build dynamic phase scores object
        const phaseScoresFormatted: Record<string, number> = {};
        for (const phase of scorablePhases) {
          phaseScoresFormatted[`phase${phase}`] = phaseScores[phase] || 0;
        }

        return {
          teamId: team.id,
          teamName: team.name,
          track: team.track || null,
          trackId: team.trackId || null,
          leaderId: team.leaderId,
          members,
          phaseScores: phaseScoresFormatted,
          totalScore,
        };
      })
    );

    // Sort by total score descending
    leaderboardData.sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json(
      {
        leaderboard: leaderboardData,
        scoringCriteria,
        phaseConfig: phaseConfig.filter((p) => p.maxPoints > 0),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
