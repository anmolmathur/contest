import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, scores } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";
import { calculateWeightedScore, type ScoringCriterion } from "@/lib/scoring";
import { resolveScale } from "@/lib/contest-config";

/**
 * GET /api/c/[slug]/scores/all[?judgeOnly=true]
 *
 * Judges/admins only. Returns every score in the contest (or just the
 * caller's with judgeOnly=true), each with `weightedScore` (0–100, string
 * with 2 decimals, normalised from the contest's scale) plus the jury
 * `feedback` and `privateNote`.
 *
 * { scores: [...], scoringScale: { min, max, step, labels? } }
 */
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

    // Verify user is a judge for this contest
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json(
        { error: "Only judges can access scores" },
        { status: 403 }
      );
    }

    // Check for judgeOnly query parameter
    const { searchParams } = new URL(req.url);
    const judgeOnly = searchParams.get("judgeOnly") === "true";

    // Get all teams for this contest
    const contestTeams = await db.query.teams.findMany({
      where: eq(teams.contestId, contest.id),
      columns: { id: true },
    });
    const contestTeamIds = contestTeams.map((t) => t.id);

    if (contestTeamIds.length === 0) {
      return NextResponse.json({ scores: [] }, { status: 200 });
    }

    // Get submissions for contest teams to get their IDs for DB-level filtering
    const contestSubmissions = await db.query.submissions.findMany({
      where: inArray(submissions.teamId, contestTeamIds.length > 0 ? contestTeamIds : ["__none__"]),
      columns: { id: true },
    });
    const contestSubmissionIds = contestSubmissions.map((s) => s.id);

    if (contestSubmissionIds.length === 0) {
      return NextResponse.json({ scores: [] }, { status: 200 });
    }

    // Get scores filtered at DB level by submission IDs (and optionally judge)
    let contestScores;
    if (judgeOnly) {
      contestScores = await db.query.scores.findMany({
        where: and(
          inArray(scores.submissionId, contestSubmissionIds),
          eq(scores.judgeId, session.user.id)
        ),
        with: {
          submission: {
            with: {
              team: true,
            },
          },
          judge: { columns: { id: true, name: true, email: true } },
        },
      });
    } else {
      contestScores = await db.query.scores.findMany({
        where: inArray(scores.submissionId, contestSubmissionIds),
        with: {
          submission: {
            with: {
              team: true,
            },
          },
          judge: { columns: { id: true, name: true, email: true } },
        },
      });
    }

    const scoringCriteria = (contest.scoringCriteria as ScoringCriterion[]) || [];
    const scoringScale = resolveScale(contest.scoringScale);

    // Format the response
    const formattedScores = contestScores.map((score) => {
      const criteriaScoresData = score.criteriaScores as Record<string, number> | null;
      const weightedScore = calculateWeightedScore(criteriaScoresData, scoringCriteria, scoringScale);

      return {
        id: score.id,
        submissionId: score.submissionId,
        judgeId: score.judgeId,
        judgeName: score.judge?.name || "Unknown",
        judgeEmail: score.judge?.email || "Unknown",
        teamId: score.submission?.teamId,
        teamName: score.submission?.team?.name || "Unknown",
        phase: score.submission?.phase,
        // Legacy fixed fields
        aiUsageScore: score.aiUsageScore,
        businessImpactScore: score.businessImpactScore,
        uxScore: score.uxScore,
        innovationScore: score.innovationScore,
        executionScore: score.executionScore,
        // Dynamic criteria scores
        criteriaScores: criteriaScoresData,
        weightedScore: weightedScore.toFixed(2),
        // Jury comments (shown to the team after results) + jury-only note
        feedback: score.feedback ?? null,
        privateNote: score.privateNote ?? null,
        createdAt: score.createdAt,
        updatedAt: score.updatedAt,
      };
    });

    return NextResponse.json({ scores: formattedScores, scoringScale }, { status: 200 });
  } catch (error) {
    console.error("Get all scores error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
