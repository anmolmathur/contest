import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, submissions, contestUsers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";
import { teamPhaseScores, scorablePhases, type ScoringCriterion } from "@/lib/scoring";
import { resolveScale } from "@/lib/contest-config";
import { contestTerminology } from "@/lib/api-input";

/**
 * GET /api/c/[slug]/leaderboard  (public)
 *
 * {
 *   leaderboard: [{ teamId, teamName, track, trackId, leaderId, members, phaseScores: { phaseN }, totalScore, problem }],
 *   eliminated: [{ teamId, teamName, track, outAt }],   // teams "out" at a gate stage (not ranked)
 *   scoringCriteria, phaseConfig (scorable phases only),
 *   scoringScale, terminology
 * }
 *
 * Scores are normalised from the contest's scale to 0–100 before weighting
 * (lib/scoring), so totals for 0–100 contests are unchanged.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Leaderboard is intentionally public so /c/[slug]/results can render for
    // unauthenticated visitors — including after a contest is archived.
    // (The middleware already allowlists this path.)
    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const scoringCriteria = (contest.scoringCriteria as ScoringCriterion[]) || [];
    const scoringScale = resolveScale(contest.scoringScale);

    // Get only approved teams for this contest with their members and track
    const approvedTeams = await db.query.teams.findMany({
      where: and(
        eq(teams.contestId, contest.id),
        eq(teams.approved, true)
      ),
      with: {
        trackRef: {
          columns: {
            id: true,
            name: true,
          },
        },
        problem: { columns: { id: true, title: true } },
        stageDecisions: { columns: { phase: true, decision: true } },
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

    // One query for every approved team's submissions + scores.
    const allSubmissions = approvedTeams.length
      ? await db.query.submissions.findMany({
          where: inArray(submissions.teamId, approvedTeams.map((t) => t.id)),
          columns: { id: true, teamId: true, phase: true },
          with: { scores: { columns: { criteriaScores: true } } },
        })
      : [];

    const ranked = approvedTeams.filter((t) => t.status !== "eliminated");
    const leaderboardData = ranked.map((team) => {
      const teamSubmissions = allSubmissions.filter((s) => s.teamId === team.id);
      const { phaseScores, totalScore } = teamPhaseScores(
        teamSubmissions,
        scoringCriteria,
        contest.phaseConfig,
        scoringScale,
      );

      // Build members list from contest-scoped membership.
      // Participants and mentors are both surfaced, but tagged so the
      // client can display mentors distinctly (and exclude them from
      // "team size" visuals).
      const members = team.contestMembers.map((cu) => ({
        id: cu.user?.id,
        name: cu.user?.name,
        isLeader: cu.user?.id === team.leaderId,
        role: cu.role as "admin" | "judge" | "participant" | "mentor",
        participantRole: cu.participantRole ?? null,
        extraRoles: Array.isArray(cu.extraRoles) ? (cu.extraRoles as string[]) : [],
      }));

      return {
        teamId: team.id,
        teamName: team.name,
        track: team.trackRef?.name || team.track || null,
        trackId: team.trackId || null,
        leaderId: team.leaderId,
        members,
        phaseScores,
        totalScore,
        problem: team.problem ? { id: team.problem.id, title: team.problem.title } : null,
      };
    });

    const phaseName = (n: number) =>
      ((Array.isArray(contest.phaseConfig) ? contest.phaseConfig : []) as Array<{ phase: number; name: string }>).find(
        (p) => p.phase === n,
      )?.name ?? null;
    const eliminated = approvedTeams
      .filter((t) => t.status === "eliminated")
      .map((t) => {
        const out = t.stageDecisions.find((d) => d.decision === "out");
        return {
          teamId: t.id,
          teamName: t.name,
          track: t.trackRef?.name || t.track || null,
          outAt: out ? phaseName(out.phase) : null,
        };
      });

    // Sort by total score descending
    leaderboardData.sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json(
      {
        leaderboard: leaderboardData,
        eliminated,
        scoringCriteria,
        phaseConfig: scorablePhases(contest.phaseConfig),
        scoringScale,
        terminology: contestTerminology(contest),
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
