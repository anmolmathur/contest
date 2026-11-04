import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, contestUsers } from "@/lib/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";
import { teamPhaseScores, type ScoringCriterion } from "@/lib/scoring";
import { resolveScale } from "@/lib/contest-config";
import { withFullRosters } from "@/lib/multi-team";

interface Prize {
  rank: number;
  label: string;
  amount?: number | null;
  color: string;
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
    const scoringScale = resolveScale(contest.scoringScale);
    const prizes = (contest.prizes as Prize[]) || [];

    // Get approved teams for THIS contest with contest-scoped members
    const approvedTeams = await withFullRosters(contest, await db.query.teams.findMany({
      where: and(
        eq(teams.contestId, contest.id),
        eq(teams.approved, true),
        ne(teams.status, "eliminated")
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
    }));

    // One query for every approved team's submissions + scores.
    const allSubmissions = approvedTeams.length
      ? await db.query.submissions.findMany({
          where: inArray(submissions.teamId, approvedTeams.map((t) => t.id)),
          columns: { id: true, teamId: true, phase: true },
          with: { scores: { columns: { criteriaScores: true } } },
        })
      : [];

    const leaderboardData = approvedTeams.map((team) => {
        const { phaseScores, totalScore } = teamPhaseScores(
          allSubmissions.filter((s) => s.teamId === team.id),
          scoringCriteria,
          contest.phaseConfig,
          scoringScale,
        );

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
      });

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
