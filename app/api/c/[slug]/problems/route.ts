import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { problemStatements, teams } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { canAdminContest, getContestUser, resolveContest } from "@/lib/contest-auth";
import { parseProblemInput, problemWithClaims } from "@/lib/problems";

/**
 * GET /api/c/[slug]/problems — Problem Bank (public for non-draft contests).
 *   Returns open/approved/closed problems with the teams that claimed them.
 *   Admins additionally see proposed/rejected ones; a team sees its own proposals.
 *   Response: { problems: ProblemWithClaims[] }
 *
 * POST /api/c/[slug]/problems
 *   Admin: create a bank problem (status "open").
 *   Participant in a team: propose a problem (status "proposed", awaiting
 *   admin approval; approval assigns it to the proposing team).
 *   Body: { title, description?, trackId?, ownerDepartment?, sponsor?,
 *           metricTemplate?: { metric, unit, direction }, maxTeams? }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

    const session = await auth();
    const userId = session?.user?.id;
    const isAdmin = userId ? await canAdminContest(userId, contest.id) : false;
    if (contest.status === "draft" && !isAdmin) {
      return NextResponse.json({ problems: [] });
    }
    const me = userId ? await getContestUser(userId, contest.id) : null;

    const rows = await db.query.problemStatements.findMany({
      where: eq(problemStatements.contestId, contest.id),
      orderBy: [asc(problemStatements.sortOrder), asc(problemStatements.createdAt)],
    });
    const contestTeams = await db.query.teams.findMany({
      where: eq(teams.contestId, contest.id),
      columns: { id: true, name: true, problemId: true, status: true },
    });

    const visible = rows.filter(
      (p) =>
        isAdmin ||
        p.status === "open" ||
        p.status === "approved" ||
        p.status === "closed" ||
        (me?.teamId && p.proposedByTeamId === me.teamId),
    );
    return NextResponse.json({ problems: visible.map((p) => problemWithClaims(p, contestTeams)) });
  } catch (error) {
    console.error("Error listing problems:", error);
    return NextResponse.json({ error: "Failed to list problems" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (contest.status === "completed" || contest.status === "archived") {
      return NextResponse.json({ error: "This contest is closed" }, { status: 409 });
    }

    const parsed = parseProblemInput(await req.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (parsed.value.trackId) {
      const ok = await db.query.tracks.findFirst({
        where: (t, { and: a, eq: e }) => a(e(t.id, parsed.value.trackId!), e(t.contestId, contest.id)),
        columns: { id: true },
      });
      if (!ok) return NextResponse.json({ error: "Unknown value lens / track" }, { status: 400 });
    }

    const isAdmin = await canAdminContest(session.user.id, contest.id);
    if (isAdmin) {
      const [created] = await db
        .insert(problemStatements)
        .values({ ...parsed.value, contestId: contest.id, status: "open", createdBy: session.user.id })
        .returning();
      return NextResponse.json(created, { status: 201 });
    }

    const me = await getContestUser(session.user.id, contest.id);
    if (!me || me.role !== "participant" || !me.teamId) {
      return NextResponse.json({ error: "Join a team first to propose a problem" }, { status: 403 });
    }
    const team = await db.query.teams.findFirst({ where: and(eq(teams.id, me.teamId), eq(teams.contestId, contest.id)) });
    if (!team || team.status === "eliminated") {
      return NextResponse.json({ error: "Your team can't propose problems" }, { status: 403 });
    }
    const pending = await db.query.problemStatements.findFirst({
      where: and(eq(problemStatements.proposedByTeamId, team.id), eq(problemStatements.status, "proposed")),
      columns: { id: true },
    });
    if (pending) {
      return NextResponse.json({ error: "Your team already has a proposal waiting for approval" }, { status: 409 });
    }
    const [created] = await db
      .insert(problemStatements)
      .values({
        ...parsed.value,
        contestId: contest.id,
        maxTeams: 1,
        status: "proposed",
        proposedByTeamId: team.id,
        createdBy: session.user.id,
        sortOrder: 1000,
      })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating problem:", error);
    return NextResponse.json({ error: "Failed to create problem" }, { status: 500 });
  }
}
