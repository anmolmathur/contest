import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { impactMetrics, teams } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getEffectiveContestRole, resolveContest } from "@/lib/contest-auth";
import { parseMetricInput } from "@/lib/impact-server";

/**
 * GET /api/c/[slug]/metrics[?teamId=]
 *   Participants/mentors: their own team's metrics.
 *   Jury, validators, admins: all teams (or one with ?teamId=), each row with teamName.
 *   Response: { metrics: ImpactMetric[] & { teamName }[] }
 *
 * POST /api/c/[slug]/metrics — a team member adds a metric (draft).
 *   Body: { name, unit?, direction, category, sourceSystem?, method?,
 *           baselineValue?, baselinePeriod?, baselineEvidence?: string[], targetValue? }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    const eff = await getEffectiveContestRole(session.user.id, contest.id);
    if (eff.access === "none") return NextResponse.json({ error: "Not a member of this contest" }, { status: 403 });

    const staff = eff.access === "admin" || eff.access === "judge" || eff.access === "validator" || eff.access === "inspect";
    const requested = req.nextUrl.searchParams.get("teamId");
    const teamId = staff ? requested : eff.teamId;
    if (!staff && !teamId) return NextResponse.json({ metrics: [] });

    const rows = await db.query.impactMetrics.findMany({
      where: teamId
        ? and(eq(impactMetrics.contestId, contest.id), eq(impactMetrics.teamId, teamId))
        : eq(impactMetrics.contestId, contest.id),
      orderBy: [asc(impactMetrics.sortOrder), asc(impactMetrics.createdAt)],
    });
    const teamRows = await db.query.teams.findMany({
      where: eq(teams.contestId, contest.id),
      columns: { id: true, name: true },
    });
    const name = new Map(teamRows.map((t) => [t.id, t.name]));
    return NextResponse.json({ metrics: rows.map((r) => ({ ...r, teamName: name.get(r.teamId) ?? "" })) });
  } catch (error) {
    console.error("Error listing metrics:", error);
    return NextResponse.json({ error: "Failed to list metrics" }, { status: 500 });
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
    if (eff.access !== "participant" || !eff.teamId) {
      return NextResponse.json({ error: "Only team members can add metrics" }, { status: 403 });
    }
    const team = await db.query.teams.findFirst({ where: and(eq(teams.id, eff.teamId), eq(teams.contestId, contest.id)) });
    if (!team || team.status === "eliminated") return NextResponse.json({ error: "Your team can't add metrics" }, { status: 403 });

    const existing = await db.query.impactMetrics.findMany({ where: eq(impactMetrics.teamId, team.id), columns: { id: true } });
    if (existing.length >= 5) return NextResponse.json({ error: "Up to 5 metrics per team — keep the ones that matter" }, { status: 400 });

    const parsed = parseMetricInput(await req.json().catch(() => null), true);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const [created] = await db
      .insert(impactMetrics)
      .values({ ...parsed.value, name: parsed.value.name!, contestId: contest.id, teamId: team.id, sortOrder: existing.length })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating metric:", error);
    return NextResponse.json({ error: "Failed to create metric" }, { status: 500 });
  }
}
