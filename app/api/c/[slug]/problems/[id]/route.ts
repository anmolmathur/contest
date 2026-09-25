import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { problemStatements, teams } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { canAdminContest, resolveContest } from "@/lib/contest-auth";
import { metricTemplateOf } from "@/lib/problems";

const STATUSES = ["open", "proposed", "approved", "rejected", "closed"];

/**
 * PATCH /api/c/[slug]/problems/[id] — admin edit / approve / reject / close.
 *   Body: any of { title, description, trackId, ownerDepartment, sponsor,
 *                  metricTemplate, maxTeams, status }
 *   Approving a team proposal (status → "approved") assigns it to that team.
 * DELETE /api/c/[slug]/problems/[id] — admin; unclaims any teams first.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { slug, id } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (!(await canAdminContest(session.user.id, contest.id))) {
      return NextResponse.json({ error: "Only contest admins can edit problems" }, { status: 403 });
    }
    const problem = await db.query.problemStatements.findFirst({
      where: and(eq(problemStatements.id, id), eq(problemStatements.contestId, contest.id)),
    });
    if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

    const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const patch: Partial<typeof problemStatements.$inferInsert> = { updatedAt: new Date() };
    const text = (k: string, max: number) =>
      b[k] === undefined ? undefined : typeof b[k] === "string" && (b[k] as string).trim() ? (b[k] as string).trim().slice(0, max) : null;
    const title = text("title", 255);
    if (title === null) return NextResponse.json({ error: "Title can't be empty" }, { status: 400 });
    if (title !== undefined) patch.title = title;
    if (b.description !== undefined) patch.description = text("description", 5000);
    if (b.ownerDepartment !== undefined) patch.ownerDepartment = text("ownerDepartment", 255);
    if (b.sponsor !== undefined) patch.sponsor = text("sponsor", 255);
    if (b.trackId !== undefined) patch.trackId = text("trackId", 64);
    if (b.metricTemplate !== undefined) patch.metricTemplate = metricTemplateOf(b.metricTemplate);
    if (b.maxTeams !== undefined) {
      const n = Number(b.maxTeams);
      if (!Number.isInteger(n) || n < 1 || n > 20) return NextResponse.json({ error: "maxTeams must be 1–20" }, { status: 400 });
      patch.maxTeams = n;
    }
    if (b.status !== undefined) {
      if (typeof b.status !== "string" || !STATUSES.includes(b.status)) {
        return NextResponse.json({ error: `status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
      }
      patch.status = b.status;
    }

    const [updated] = await db.update(problemStatements).set(patch).where(eq(problemStatements.id, id)).returning();

    // Approving a proposal hands it to the proposing team.
    if (patch.status === "approved" && problem.proposedByTeamId) {
      await db
        .update(teams)
        .set({ problemId: id, ...(updated.trackId ? { trackId: updated.trackId } : {}), updatedAt: new Date() })
        .where(and(eq(teams.id, problem.proposedByTeamId), eq(teams.contestId, contest.id)));
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating problem:", error);
    return NextResponse.json({ error: "Failed to update problem" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { slug, id } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (!(await canAdminContest(session.user.id, contest.id))) {
      return NextResponse.json({ error: "Only contest admins can delete problems" }, { status: 403 });
    }
    await db.update(teams).set({ problemId: null }).where(and(eq(teams.problemId, id), eq(teams.contestId, contest.id)));
    const deleted = await db
      .delete(problemStatements)
      .where(and(eq(problemStatements.id, id), eq(problemStatements.contestId, contest.id)))
      .returning({ id: problemStatements.id });
    if (deleted.length === 0) return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting problem:", error);
    return NextResponse.json({ error: "Failed to delete problem" }, { status: 500 });
  }
}
