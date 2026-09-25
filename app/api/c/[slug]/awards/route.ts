import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canAdminContest, resolveContest } from "@/lib/contest-auth";
import { resolveSettings } from "@/lib/contest-config";
import type { ContestAward } from "@/lib/contest-types";

function awardsOf(raw: unknown): ContestAward[] {
  return (Array.isArray(raw) ? raw : []).filter((a) => a && typeof a.key === "string" && typeof a.label === "string") as ContestAward[];
}

/**
 * GET /api/c/[slug]/awards — category awards with winner team names.
 *   Winners are hidden from the public until results are published
 *   (admins always see them).
 * PUT /api/c/[slug]/awards — admin; Body: { awards: ContestAward[] }
 *   (labels, amounts and winnerTeamId per award). A team may win at most one
 *   category award.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    const session = await auth();
    const isAdmin = session?.user?.id ? await canAdminContest(session.user.id, contest.id) : false;
    const revealed = isAdmin || resolveSettings(contest.settings).resultsPublished || contest.status === "completed";
    const list = awardsOf(contest.awards);
    const teamRows = await db.query.teams.findMany({ where: eq(teams.contestId, contest.id), columns: { id: true, name: true } });
    const name = new Map(teamRows.map((t) => [t.id, t.name]));
    return NextResponse.json({
      revealed,
      awards: list.map((a) => ({
        ...a,
        winnerTeamId: revealed ? a.winnerTeamId ?? null : null,
        winnerTeamName: revealed && a.winnerTeamId ? name.get(a.winnerTeamId) ?? null : null,
      })),
    });
  } catch (error) {
    console.error("Error listing awards:", error);
    return NextResponse.json({ error: "Failed to list awards" }, { status: 500 });
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
      return NextResponse.json({ error: "Only contest admins can edit awards" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as { awards?: unknown } | null;
    if (!Array.isArray(body?.awards)) return NextResponse.json({ error: "awards must be a list" }, { status: 400 });
    const teamIds = new Set(
      (await db.query.teams.findMany({ where: eq(teams.contestId, contest.id), columns: { id: true } })).map((t) => t.id),
    );
    const clean: ContestAward[] = [];
    const winners = new Set<string>();
    for (const raw of body.awards.slice(0, 20)) {
      const a = raw as Partial<ContestAward>;
      const label = typeof a.label === "string" ? a.label.trim().slice(0, 80) : "";
      if (!label) return NextResponse.json({ error: "Every award needs a name" }, { status: 400 });
      const key = typeof a.key === "string" && a.key.trim() ? a.key.trim().slice(0, 40) : label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const amount = a.amount === null || a.amount === undefined || (a.amount as unknown) === "" ? null : Math.max(0, Math.round(Number(a.amount)));
      if (amount !== null && !Number.isFinite(amount)) return NextResponse.json({ error: `Invalid amount for "${label}"` }, { status: 400 });
      const winnerTeamId = typeof a.winnerTeamId === "string" && a.winnerTeamId ? a.winnerTeamId : null;
      if (winnerTeamId && !teamIds.has(winnerTeamId)) return NextResponse.json({ error: `Unknown team for "${label}"` }, { status: 400 });
      if (winnerTeamId && winners.has(winnerTeamId)) {
        return NextResponse.json({ error: "A team can win only one category award" }, { status: 400 });
      }
      if (winnerTeamId) winners.add(winnerTeamId);
      clean.push({
        key,
        label,
        description: typeof a.description === "string" ? a.description.trim().slice(0, 300) : "",
        amount,
        winnerTeamId,
      });
    }
    await db.update(contests).set({ awards: clean, updatedAt: new Date() }).where(eq(contests.id, contest.id));
    return NextResponse.json({ awards: clean });
  } catch (error) {
    console.error("Error saving awards:", error);
    return NextResponse.json({ error: "Failed to save awards" }, { status: 500 });
  }
}
