import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { impactMetrics, submissions, teams } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";
import { resolveSubmissionFields, parseAgentCharter } from "@/lib/submission-fields";
import { improvementPct, totalValueInr } from "@/lib/impact";

/**
 * GET /api/c/[slug]/impact-summary (public) — the "Value Unlocked" meter.
 * Only Auditor/Finance-validated numbers count.
 * { totalValueInr, realisedInr, recurringAnnualInr, avgImprovementPct, validatedMetrics,
 *   teamsWithProof, activeTeams, agents, paths: Record<path, teams> }
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (contest.status === "draft") return NextResponse.json({ error: "Not available" }, { status: 404 });

    const [metrics, teamRows] = await Promise.all([
      db.query.impactMetrics.findMany({ where: eq(impactMetrics.contestId, contest.id) }),
      db.query.teams.findMany({
        where: and(eq(teams.contestId, contest.id), eq(teams.approved, true)),
        columns: { id: true, status: true, solutionPaths: true },
      }),
    ]);
    const active = teamRows.filter((t) => t.status !== "eliminated");
    const valued = metrics.filter((m) => m.financeStatus === "validated");
    const pcts = metrics
      .filter((m) => m.actualStatus === "validated")
      .map((m) => improvementPct(m))
      .filter((p): p is number => p !== null);
    const avgImprovementPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;

    const paths: Record<string, number> = {};
    for (const t of active) for (const p of Array.isArray(t.solutionPaths) ? (t.solutionPaths as string[]) : []) paths[p] = (paths[p] ?? 0) + 1;

    // Agents declared in the latest Agent Charter of each active team.
    const charterKeys = resolveSubmissionFields(contest.submissionFields)
      .filter((f) => f.type === "agentCharter")
      .map((f) => f.key);
    let agents = 0;
    if (charterKeys.length && active.length) {
      const subs = await db.query.submissions.findMany({
        where: inArray(submissions.teamId, active.map((t) => t.id)),
        columns: { teamId: true, phase: true, fields: true },
      });
      // Per team: the charter from its latest stage that has one.
      const latest = new Map<string, { phase: number; n: number }>();
      for (const s of subs) {
        const vals = (s.fields ?? {}) as Record<string, unknown>;
        const n = charterKeys.reduce((acc, k) => acc + parseAgentCharter(vals[k]).length, 0);
        const prev = latest.get(s.teamId);
        if (n > 0 && (!prev || s.phase > prev.phase)) latest.set(s.teamId, { phase: s.phase, n });
      }
      for (const t of active) agents += latest.get(t.id)?.n ?? 0;
    }

    return NextResponse.json({
      totalValueInr: valued.reduce((s, m) => s + totalValueInr(m), 0),
      realisedInr: valued.reduce((s, m) => s + (m.realisedValueInr ?? 0), 0),
      recurringAnnualInr: valued.reduce((s, m) => s + (m.recurringAnnualValueInr ?? 0), 0),
      avgImprovementPct: avgImprovementPct === null ? null : Math.round(avgImprovementPct * 10) / 10,
      validatedMetrics: metrics.filter((m) => m.actualStatus === "validated").length,
      teamsWithProof: new Set(valued.map((m) => m.teamId)).size,
      activeTeams: active.length,
      agents,
      paths,
    });
  } catch (error) {
    console.error("Error building impact summary:", error);
    return NextResponse.json({ error: "Failed to build summary" }, { status: 500 });
  }
}
