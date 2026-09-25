import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, teams } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { canReadContest, resolveContest } from "@/lib/contest-auth";
import { resolveSettings } from "@/lib/contest-config";
import { parseAgentCharter, resolveSubmissionFields } from "@/lib/submission-fields";

/**
 * GET /api/c/[slug]/agents — Agent Registry: every agent from each team's
 * latest Agent Charter. Public when the showcase is enabled; otherwise
 * contest members only.
 * { agents: Array<AgentCharterEntry & { teamId, teamName, track, stage }> }
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (!resolveSettings(contest.settings).showcaseEnabled || contest.status === "draft") {
      const session = await auth();
      if (!session?.user?.id || !(await canReadContest(session.user.id, contest.id))) {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
      }
    }
    const charterKeys = resolveSubmissionFields(contest.submissionFields)
      .filter((f) => f.type === "agentCharter")
      .map((f) => f.key);
    if (charterKeys.length === 0) return NextResponse.json({ agents: [] });

    const teamRows = await db.query.teams.findMany({
      where: and(eq(teams.contestId, contest.id), eq(teams.approved, true)),
      columns: { id: true, name: true, status: true },
      with: { trackRef: { columns: { name: true } } },
    });
    if (teamRows.length === 0) return NextResponse.json({ agents: [] });
    const subs = await db.query.submissions.findMany({
      where: inArray(submissions.teamId, teamRows.map((t) => t.id)),
      columns: { teamId: true, phase: true, fields: true },
    });
    const phaseName = new Map(
      ((Array.isArray(contest.phaseConfig) ? contest.phaseConfig : []) as Array<{ phase: number; name: string }>).map((p) => [p.phase, p.name]),
    );

    const agents = [];
    for (const t of teamRows) {
      const withCharter = subs
        .filter((s) => s.teamId === t.id)
        .map((s) => ({
          phase: s.phase,
          entries: charterKeys.flatMap((k) => parseAgentCharter(((s.fields ?? {}) as Record<string, unknown>)[k])),
        }))
        .filter((s) => s.entries.length > 0)
        .sort((a, b) => b.phase - a.phase)[0];
      if (!withCharter) continue;
      for (const e of withCharter.entries) {
        agents.push({
          ...e,
          teamId: t.id,
          teamName: t.name,
          teamStatus: t.status,
          track: t.trackRef?.name ?? null,
          stage: phaseName.get(withCharter.phase) ?? null,
        });
      }
    }
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error listing agents:", error);
    return NextResponse.json({ error: "Failed to list agents" }, { status: 500 });
  }
}
