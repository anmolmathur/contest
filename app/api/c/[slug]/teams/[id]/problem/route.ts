import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { problemStatements, teams } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PUT /api/c/[slug]/teams/[id]/problem — organiser sets a crew's problem.
 * Body: { problemId: string | null, override?: boolean }
 *
 * For crews that can't claim from the Problem Bank themselves. Contest and
 * platform admins only. Like a crew's own claim it also sets the crew's
 * value lens (track) to the problem's. Unlike a claim it works after the
 * jury's pitch decision, and `override: true` assigns past the problem's
 * maxTeams (the first try returns 409 { code: "PROBLEM_FULL" }).
 * `problemId: null` clears the crew's problem.
 * Response: { ok: true, problemId, trackId }
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug, id } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

    if (!(await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined))) {
      return NextResponse.json({ error: "Only organisers can set a team's problem" }, { status: 403 });
    }

    const team = await db.query.teams.findFirst({ where: and(eq(teams.id, id), eq(teams.contestId, contest.id)) });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { problemId?: unknown; override?: unknown };
    if (body.problemId !== null && (typeof body.problemId !== "string" || !UUID_RE.test(body.problemId))) {
      return NextResponse.json({ error: "problemId must be a problem id or null" }, { status: 400 });
    }

    if (body.problemId === null) {
      await db.update(teams).set({ problemId: null, updatedAt: new Date() }).where(eq(teams.id, team.id));
      return NextResponse.json({ ok: true, problemId: null, trackId: team.trackId });
    }

    const problem = await db.query.problemStatements.findFirst({
      where: and(eq(problemStatements.id, body.problemId), eq(problemStatements.contestId, contest.id)),
    });
    if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    if (problem.status !== "open" && problem.status !== "approved") {
      return NextResponse.json(
        { error: `This problem is ${problem.status}; approve or reopen it in the Problem Bank first` },
        { status: 409 },
      );
    }

    if (team.problemId !== problem.id && body.override !== true) {
      const others = await db.query.teams.findMany({
        where: and(eq(teams.problemId, problem.id), ne(teams.id, team.id)),
        columns: { status: true },
      });
      const active = others.filter((t) => t.status !== "eliminated" && t.status !== "withdrawn").length;
      if (active >= problem.maxTeams) {
        return NextResponse.json(
          {
            error: `"${problem.title}" is already taken by ${active} of ${problem.maxTeams} allowed teams`,
            code: "PROBLEM_FULL",
          },
          { status: 409 },
        );
      }
    }

    const trackId = problem.trackId ?? team.trackId;
    await db
      .update(teams)
      .set({ problemId: problem.id, trackId, updatedAt: new Date() })
      .where(eq(teams.id, team.id));
    return NextResponse.json({ ok: true, problemId: problem.id, trackId });
  } catch (error) {
    console.error("Error setting team problem:", error);
    return NextResponse.json({ error: "Failed to set the problem" }, { status: 500 });
  }
}
