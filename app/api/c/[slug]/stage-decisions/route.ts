import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stageDecisions, teams } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getEffectiveContestRole, resolveContest } from "@/lib/contest-auth";
import { phasesOf } from "@/lib/stage-gates";
import { contestTerm } from "@/lib/api-input";

const DECISIONS = ["go", "conditional", "out"] as const;

/**
 * GET /api/c/[slug]/stage-decisions
 *   Jury/admins/validators/mentors: every decision. Participants: their own team's.
 *   Response: { decisions: Array<{ teamId, phase, decision, conditions, decidedAt }> }
 *
 * POST /api/c/[slug]/stage-decisions  (jury or admin)
 *   Body: { teamId, phase, decision: "go" | "conditional" | "out", conditions? }
 *   `phase` must be a gate stage (phaseConfig[].gate). "out" eliminates the
 *   team; changing it back to go/conditional reinstates it. Conditions are
 *   required for "conditional".
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    const eff = await getEffectiveContestRole(session.user.id, contest.id);
    if (eff.access === "none") return NextResponse.json({ error: "Not a member of this contest" }, { status: 403 });

    const where =
      eff.access === "participant"
        ? eff.teamId
          ? and(eq(stageDecisions.contestId, contest.id), eq(stageDecisions.teamId, eff.teamId))
          : undefined
        : eq(stageDecisions.contestId, contest.id);
    if (!where) return NextResponse.json({ decisions: [] });
    const rows = await db.query.stageDecisions.findMany({ where });
    return NextResponse.json({
      decisions: rows.map((r) => ({
        teamId: r.teamId,
        phase: r.phase,
        decision: r.decision,
        conditions: r.conditions,
        decidedAt: r.decidedAt,
      })),
    });
  } catch (error) {
    console.error("Error listing stage decisions:", error);
    return NextResponse.json({ error: "Failed to list decisions" }, { status: 500 });
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
    const eff = await getEffectiveContestRole(session.user.id, contest.id);
    if (eff.access !== "judge" && eff.access !== "admin") {
      return NextResponse.json({ error: `Only the ${contestTerm(contest, "judge").toLowerCase()} or organisers can decide` }, { status: 403 });
    }

    const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const teamId = typeof b.teamId === "string" ? b.teamId : "";
    const phase = typeof b.phase === "number" ? b.phase : Number(b.phase);
    const decision = b.decision as (typeof DECISIONS)[number];
    const conditions = typeof b.conditions === "string" && b.conditions.trim() ? b.conditions.trim().slice(0, 4000) : null;

    if (!DECISIONS.includes(decision)) {
      return NextResponse.json({ error: "decision must be go, conditional or out" }, { status: 400 });
    }
    const gate = phasesOf(contest.phaseConfig).find((p) => p.phase === phase && p.gate);
    if (!gate) return NextResponse.json({ error: "That stage has no go/no-go decision" }, { status: 400 });
    if (decision === "conditional" && !conditions) {
      return NextResponse.json({ error: "Write down the changes agreed for Go-with-changes" }, { status: 400 });
    }
    const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.contestId, contest.id)) });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const existing = await db.query.stageDecisions.findFirst({
      where: and(eq(stageDecisions.teamId, team.id), eq(stageDecisions.phase, phase)),
    });
    const values = { decision, conditions, decidedBy: session.user.id, decidedAt: new Date() };
    if (existing) {
      await db.update(stageDecisions).set(values).where(eq(stageDecisions.id, existing.id));
    } else {
      await db.insert(stageDecisions).values({ ...values, contestId: contest.id, teamId: team.id, phase });
    }

    // "out" eliminates; any other decision reinstates a previously eliminated team.
    const status = decision === "out" ? "eliminated" : team.status === "eliminated" ? "active" : team.status;
    if (status !== team.status) {
      await db.update(teams).set({ status, updatedAt: new Date() }).where(eq(teams.id, team.id));
    }
    return NextResponse.json({ teamId: team.id, phase, decision, conditions, teamStatus: status });
  } catch (error) {
    console.error("Error recording stage decision:", error);
    return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
  }
}
