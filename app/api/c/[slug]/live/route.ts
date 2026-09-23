import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests, contestUsers, scores, submissions, teams } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { canAdminContest, canJudgeContest, isContestMutable, resolveContest } from "@/lib/contest-auth";
import { EMPTY_LIVE_STATE, resolveLiveState, type LiveState } from "@/lib/contest-config";
import { resolveSubmissionFields, submissionHeadline, submissionValues } from "@/lib/submission-fields";
import { scorablePhases, teamPhaseScores, type ScoringCriterion } from "@/lib/scoring";
import type {
  LiveCurrent,
  LiveLeaderboardEntry,
  LivePayload,
  LivePutBody,
  LiveTeamRef,
} from "@/lib/live-types";

export const dynamic = "force-dynamic";

type ContestRow = NonNullable<Awaited<ReturnType<typeof resolveContest>>>;
type Viewer = LivePayload["viewer"];

async function viewerFor(contestId: string): Promise<{ viewer: Viewer; userId: string | null }> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { viewer: "public", userId: null };
  if (await canAdminContest(userId, contestId)) return { viewer: "admin", userId };
  if (await canJudgeContest(userId, contestId)) return { viewer: "judge", userId };
  return { viewer: "public", userId };
}

async function approvedTeams(contestId: string) {
  const rows = await db.query.teams.findMany({
    where: and(eq(teams.contestId, contestId), eq(teams.approved, true)),
    with: { trackRef: { columns: { name: true } } },
  });
  return rows.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    track: t.trackRef?.name ?? t.track ?? null,
  })) satisfies LiveTeamRef[];
}

async function buildPayload(contest: ContestRow, viewer: Viewer): Promise<LivePayload> {
  const state = resolveLiveState(contest.liveState);
  const phases = scorablePhases(contest.phaseConfig);
  const phase = state.phase !== null ? phases.find((p) => p.phase === state.phase) ?? null : null;
  const isAdmin = viewer === "admin";
  const isJudge = viewer === "judge" || isAdmin;

  const teamRefs = await approvedTeams(contest.id);
  const teamById = new Map(teamRefs.map((t) => [t.teamId, t]));

  const queue = state.queue.map((id) => teamById.get(id)).filter((t): t is LiveTeamRef => !!t);

  // ---- judges -------------------------------------------------------------
  const judgeRows = await db.query.contestUsers.findMany({
    where: and(eq(contestUsers.contestId, contest.id), eq(contestUsers.role, "judge")),
    with: { user: { columns: { id: true, name: true } } },
  });

  // ---- current team / submission -------------------------------------------
  let current: LiveCurrent | null = null;
  let scoredBy = new Set<string>();
  let scoresCount = 0;
  const fields = resolveSubmissionFields(contest.submissionFields);
  if (state.currentTeamId && teamById.has(state.currentTeamId)) {
    const ref = teamById.get(state.currentTeamId)!;
    const sub =
      state.phase !== null
        ? await db.query.submissions.findFirst({
            where: and(eq(submissions.teamId, ref.teamId), eq(submissions.phase, state.phase)),
          })
        : undefined;
    let values = sub ? submissionValues(sub as unknown as Record<string, unknown>) : {};
    let headline = submissionHeadline(fields, values);
    if (!headline) {
      // Finale rows are often created empty by the live control — fall back to
      // the team's latest earlier entry so the stage still has a one-liner.
      const earlier = await db.query.submissions.findMany({ where: eq(submissions.teamId, ref.teamId) });
      earlier.sort((a, b) => b.phase - a.phase);
      for (const e of earlier) {
        const v = submissionValues(e as unknown as Record<string, unknown>);
        const h = submissionHeadline(fields, v);
        if (h) {
          headline = h;
          if (Object.keys(values).length === 0) values = v;
          break;
        }
      }
    }
    if (sub) {
      const rows = await db.query.scores.findMany({
        where: eq(scores.submissionId, sub.id),
        columns: { judgeId: true },
      });
      scoresCount = rows.length;
      scoredBy = new Set(rows.map((r) => r.judgeId));
    }
    current = {
      ...ref,
      submissionId: sub?.id ?? null,
      values: isJudge ? values : null,
      headline,
    };
  }

  const judgesScored = judgeRows.filter((j) => scoredBy.has(j.userId)).length;

  // ---- leaderboard ----------------------------------------------------------
  let leaderboard: LiveLeaderboardEntry[] | null = null;
  let hiddenTop = 0;
  if (isAdmin || state.revealStage !== "hidden") {
    const criteria = (contest.scoringCriteria as ScoringCriterion[] | null) ?? [];
    const ids = teamRefs.map((t) => t.teamId);
    const subs = ids.length
      ? await db.query.submissions.findMany({
          where: inArray(submissions.teamId, ids),
          columns: { id: true, teamId: true, phase: true },
          with: { scores: { columns: { criteriaScores: true } } },
        })
      : [];
    const byTeam = new Map<string, typeof subs>();
    for (const s of subs) {
      const list = byTeam.get(s.teamId) ?? [];
      list.push(s);
      byTeam.set(s.teamId, list);
    }
    const rows = teamRefs.map((t) => {
      const { phaseScores, totalScore } = teamPhaseScores(
        byTeam.get(t.teamId) ?? [],
        criteria,
        contest.phaseConfig,
        contest.scoringScale,
      );
      return {
        ...t,
        rank: 0,
        totalScore,
        phaseScore: state.phase !== null ? phaseScores[`phase${state.phase}`] ?? 0 : 0,
        phaseScores,
      };
    });
    rows.sort((a, b) => b.totalScore - a.totalScore || a.teamName.localeCompare(b.teamName));
    rows.forEach((r, i) => (r.rank = i + 1));
    leaderboard = rows;
    if (!isAdmin && state.revealStage === "partial") {
      hiddenTop = Math.min(3, rows.length);
      leaderboard = rows.filter((r) => r.rank > 3);
    }
  }

  const payload: LivePayload = {
    state,
    phase: phase ? { phase: phase.phase, name: phase.name, maxPoints: phase.maxPoints } : null,
    current,
    queue,
    progress: { judgesTotal: judgeRows.length, judgesScored, scoresCount },
    leaderboard,
    hiddenTop,
    serverTime: Date.now(),
    viewer,
  };
  if (isAdmin) {
    payload.teams = teamRefs;
    payload.judges = judgeRows.map((j) => ({
      id: j.userId,
      name: j.user?.name ?? null,
      scored: scoredBy.has(j.userId),
    }));
  }
  return payload;
}

/** Make sure (team, phase) has a submission row so the jury can score it. */
async function ensureSubmission(teamId: string, phase: number) {
  await db
    .insert(submissions)
    .values({
      teamId,
      phase,
      fields: {},
      githubUrl: null,
      demoUrl: null,
      submissionDescription: null,
      aiPromptsUsed: null,
      aiToolsUtilized: null,
      aiScreenshots: null,
    })
    .onConflictDoNothing();
}

const noStore = { "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    const { viewer } = await viewerFor(contest.id);
    if (contest.status === "draft" && viewer === "public") {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }
    return NextResponse.json(await buildPayload(contest, viewer), { headers: noStore });
  } catch (error) {
    console.error("Live GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (!(await canAdminContest(session.user.id, contest.id))) {
      return NextResponse.json({ error: "Only contest admins can run the live finale" }, { status: 403 });
    }
    if (!(await isContestMutable(contest.id))) {
      return NextResponse.json({ error: "Contest is completed or archived" }, { status: 409 });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<LivePutBody>;
    const state: LiveState = resolveLiveState(contest.liveState);
    const phases = scorablePhases(contest.phaseConfig);
    const teamRefs = await approvedTeams(contest.id);
    const approvedIds = new Set(teamRefs.map((t) => t.teamId));
    const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

    let next: LiveState = { ...state };

    const goLive = async (teamId: string) => {
      if (next.phase === null) return "Pick the live round first";
      if (!approvedIds.has(teamId)) return "Team is not an approved team of this contest";
      await ensureSubmission(teamId, next.phase);
      next = { ...next, currentTeamId: teamId, scoringOpen: false, timerEndsAt: null };
      return null;
    };

    switch (body.action) {
      case "setPhase": {
        const p = Number(body.phase);
        if (!phases.some((ph) => ph.phase === p)) return bad("Unknown or non-scorable round");
        next = { ...next, phase: p, currentTeamId: null, scoringOpen: false, timerEndsAt: null };
        break;
      }
      case "setQueue": {
        if (!Array.isArray(body.queue)) return bad("queue must be an array of team ids");
        const q = Array.from(new Set(body.queue.map(String))).filter((id) => approvedIds.has(id));
        next = { ...next, queue: q };
        break;
      }
      case "setCurrent": {
        if (!body.teamId) return bad("teamId is required");
        const err = await goLive(String(body.teamId));
        if (err) return bad(err);
        break;
      }
      case "next": {
        const q = next.queue.filter((id) => approvedIds.has(id));
        if (q.length === 0) return bad("The pitch queue is empty");
        const idx = next.currentTeamId ? q.indexOf(next.currentTeamId) : -1;
        const target = q[idx + 1];
        if (!target) return bad("End of the queue — no more teams");
        const err = await goLive(target);
        if (err) return bad(err);
        break;
      }
      case "openScoring": {
        if (!next.currentTeamId || next.phase === null) return bad("No team is on stage");
        await ensureSubmission(next.currentTeamId, next.phase);
        next = { ...next, scoringOpen: true };
        break;
      }
      case "closeScoring":
        next = { ...next, scoringOpen: false };
        break;
      case "startTimer": {
        const s = Math.round(Number(body.seconds));
        if (!Number.isFinite(s) || s < 1 || s > 3 * 3600) return bad("seconds must be between 1 and 10800");
        next = { ...next, timerEndsAt: Date.now() + s * 1000 };
        break;
      }
      case "clearTimer":
        next = { ...next, timerEndsAt: null };
        break;
      case "reveal": {
        const r = body.revealStage;
        if (r !== "hidden" && r !== "partial" && r !== "full") return bad("revealStage must be hidden, partial or full");
        next = { ...next, revealStage: r };
        break;
      }
      case "reset":
        next = { ...EMPTY_LIVE_STATE };
        break;
      default:
        return bad("Unknown action");
    }

    next.updatedAt = Date.now();
    await db.update(contests).set({ liveState: next }).where(eq(contests.id, contest.id));

    const fresh = await resolveContest(slug);
    return NextResponse.json(await buildPayload(fresh ?? { ...contest, liveState: next }, "admin"), {
      headers: noStore,
    });
  } catch (error) {
    console.error("Live PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
