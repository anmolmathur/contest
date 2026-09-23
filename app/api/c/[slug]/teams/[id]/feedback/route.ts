import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, getContestUser, canAdminContest } from "@/lib/contest-auth";
import { resolveSettings, feedbackVisibleToTeams, resolveScale } from "@/lib/contest-config";
import { averageWeighted, scorablePhases, type ScoringCriterion } from "@/lib/scoring";
import { contestTerm } from "@/lib/api-input";

/**
 * GET /api/c/[slug]/teams/[id]/feedback
 *
 * For members of the team (participants or its mentor) and contest admins.
 *
 * {
 *   visible: boolean,
 *   phases: [{
 *     phase, name,
 *     averageWeighted: number | null,   // 0–100 average across jury members, null if unscored
 *     phasePoints: number | null,       // averageWeighted scaled to the phase's maxPoints
 *     feedback: [{ jury: "Jury member 1", text }]
 *   }]
 * }
 *
 * Scores and feedback are only included once `feedbackVisibleToTeams`
 * (results published / contest completed, unless feedbackVisibility is
 * "never") — admins always see them. Jury identities and private notes are
 * never returned; jury members are numbered consistently per team.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;
    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, id), eq(teams.contestId, contest.id)),
      columns: { id: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const contestUser = await getContestUser(session.user.id, contest.id);
    const isMember = contestUser?.teamId === team.id;
    const isAdmin = await canAdminContest(session.user.id, contest.id);
    if (!isMember && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const visible = isAdmin || feedbackVisibleToTeams(resolveSettings(contest.settings), contest.status);
    if (!visible) {
      return NextResponse.json({ visible: false, phases: [] });
    }

    const scoringCriteria = (contest.scoringCriteria as ScoringCriterion[] | null) ?? [];
    const scale = resolveScale(contest.scoringScale);

    const teamSubmissions = await db.query.submissions.findMany({
      where: eq(submissions.teamId, team.id),
      columns: { id: true, phase: true },
      with: {
        scores: {
          columns: { judgeId: true, criteriaScores: true, feedback: true },
        },
      },
    });

    // Anonymous, stable numbering of jury members across this team's rounds.
    const judgeIds = [...new Set(teamSubmissions.flatMap((s) => s.scores.map((sc) => sc.judgeId)))].sort();
    const judgeNumber = new Map(judgeIds.map((jid, i) => [jid, i + 1]));
    const judgeWord = contestTerm(contest, "judge");
    const juryLabel = (n: number) => (/jury$/i.test(judgeWord) ? `${judgeWord} member ${n}` : `${judgeWord} ${n}`);

    const phases = scorablePhases(contest.phaseConfig).map((p) => {
      const sub = teamSubmissions.find((s) => s.phase === p.phase);
      const rows = sub?.scores ?? [];
      const avg = averageWeighted(rows, scoringCriteria, scale);
      const feedback = rows
        .filter((r) => typeof r.feedback === "string" && r.feedback.trim() !== "")
        .sort((a, b) => (judgeNumber.get(a.judgeId) ?? 0) - (judgeNumber.get(b.judgeId) ?? 0))
        .map((r) => ({ jury: juryLabel(judgeNumber.get(r.judgeId) ?? 0), text: r.feedback as string }));

      return {
        phase: p.phase,
        name: p.name,
        averageWeighted: avg === null ? null : Math.round(avg * 100) / 100,
        phasePoints: avg === null ? null : Math.round((avg / 100) * p.maxPoints * 100) / 100,
        feedback,
      };
    });

    return NextResponse.json({ visible: true, phases });
  } catch (error) {
    console.error("Team feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
