import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { problemStatements, stageDecisions, teams } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { getContestUser, resolveContest } from "@/lib/contest-auth";

/**
 * POST   /api/c/[slug]/problems/[id]/claim — the caller's team takes this problem
 *        (also sets the team's value lens/track to the problem's). Allowed
 *        until the team has a gate decision.
 * DELETE /api/c/[slug]/problems/[id]/claim — the caller's team releases it.
 */
async function context(slug: string, id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const contest = await resolveContest(slug);
  if (!contest) return { error: NextResponse.json({ error: "Contest not found" }, { status: 404 }) };
  if (contest.status === "completed" || contest.status === "archived") {
    return { error: NextResponse.json({ error: "This contest is closed" }, { status: 409 }) };
  }
  const me = await getContestUser(session.user.id, contest.id);
  if (!me || me.role !== "participant" || !me.teamId) {
    return { error: NextResponse.json({ error: "Join a team first" }, { status: 403 }) };
  }
  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, me.teamId), eq(teams.contestId, contest.id)) });
  if (!team) return { error: NextResponse.json({ error: "Team not found" }, { status: 404 }) };
  if (team.status === "eliminated") {
    return { error: NextResponse.json({ error: "Your team is out of the contest" }, { status: 403 }) };
  }
  const decided = await db.query.stageDecisions.findFirst({ where: eq(stageDecisions.teamId, team.id), columns: { id: true } });
  if (decided) {
    return {
      error: NextResponse.json({ error: "The jury has already decided on your pitch; ask an organiser to change the problem" }, { status: 409 }),
    };
  }
  const problem = await db.query.problemStatements.findFirst({
    where: and(eq(problemStatements.id, id), eq(problemStatements.contestId, contest.id)),
  });
  if (!problem) return { error: NextResponse.json({ error: "Problem not found" }, { status: 404 }) };
  return { contest, team, problem };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await params;
    const c = await context(slug, id);
    if ("error" in c) return c.error;
    const { team, problem } = c;

    if (team.problemId === problem.id) return NextResponse.json({ ok: true, problemId: problem.id });
    const ownProposal = problem.proposedByTeamId === team.id;
    if (!(problem.status === "open" || (problem.status === "approved" && ownProposal))) {
      return NextResponse.json({ error: "This problem is not open for claiming" }, { status: 409 });
    }
    const others = await db.query.teams.findMany({
      where: and(eq(teams.problemId, problem.id), ne(teams.id, team.id)),
      columns: { status: true },
    });
    const active = others.filter((t) => t.status !== "eliminated" && t.status !== "withdrawn").length;
    if (active >= problem.maxTeams) {
      return NextResponse.json({ error: "This problem has already been taken by the maximum number of teams" }, { status: 409 });
    }
    await db
      .update(teams)
      .set({ problemId: problem.id, ...(problem.trackId ? { trackId: problem.trackId } : {}), updatedAt: new Date() })
      .where(eq(teams.id, team.id));
    return NextResponse.json({ ok: true, problemId: problem.id });
  } catch (error) {
    console.error("Error claiming problem:", error);
    return NextResponse.json({ error: "Failed to claim problem" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await params;
    const c = await context(slug, id);
    if ("error" in c) return c.error;
    if (c.team.problemId !== c.problem.id) return NextResponse.json({ error: "Your team hasn't claimed this problem" }, { status: 400 });
    await db.update(teams).set({ problemId: null, updatedAt: new Date() }).where(eq(teams.id, c.team.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error releasing problem:", error);
    return NextResponse.json({ error: "Failed to release problem" }, { status: 500 });
  }
}
