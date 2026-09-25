import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { impactMetrics } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getEffectiveContestRole, resolveContest } from "@/lib/contest-auth";
import { parseMetricInput } from "@/lib/impact-server";

/**
 * PATCH /api/c/[slug]/metrics/[id] — team member edits a metric and/or submits it.
 *   Body: metric fields (see POST /metrics) plus optional
 *         action: "submitBaseline" | "submitActual"
 *   Rules: editing a validated baseline/actual value resets it to draft (and
 *   Finance's valuation to pending); submitBaseline needs value + period +
 *   evidence; submitActual needs a validated baseline and value + period + evidence.
 * DELETE /api/c/[slug]/metrics/[id] — team member (before baseline validation) or admin.
 */
async function load(slug: string, id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const contest = await resolveContest(slug);
  if (!contest) return { error: NextResponse.json({ error: "Contest not found" }, { status: 404 }) };
  const metric = await db.query.impactMetrics.findFirst({
    where: and(eq(impactMetrics.id, id), eq(impactMetrics.contestId, contest.id)),
  });
  if (!metric) return { error: NextResponse.json({ error: "Metric not found" }, { status: 404 }) };
  const eff = await getEffectiveContestRole(session.user.id, contest.id);
  return { contest, metric, eff };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await params;
    const c = await load(slug, id);
    if ("error" in c) return c.error;
    const { contest, metric, eff } = c;
    if (contest.status === "completed" || contest.status === "archived") {
      return NextResponse.json({ error: "This contest is closed" }, { status: 409 });
    }
    if (eff.access !== "participant" || eff.teamId !== metric.teamId) {
      return NextResponse.json({ error: "Only the team can edit its metrics" }, { status: 403 });
    }

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const parsed = parseMetricInput(body, false);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const patch = { ...parsed.value, updatedAt: new Date() } as typeof parsed.value & { updatedAt: Date };

    const baselineKeys = ["name", "unit", "direction", "baselineValue", "baselinePeriod", "baselineEvidence", "method", "sourceSystem"];
    const actualKeys = ["actualValue", "actualPeriod", "actualEvidence"];
    const changed = (keys: string[]) =>
      keys.some((k) => k in parsed.value && JSON.stringify((parsed.value as Record<string, unknown>)[k]) !== JSON.stringify((metric as Record<string, unknown>)[k]));

    const next = { ...metric, ...patch };
    if (changed(baselineKeys) && metric.baselineStatus !== "draft") {
      Object.assign(patch, { baselineStatus: "draft", baselineValidatorId: null, financeStatus: "pending" });
      if (metric.actualStatus === "validated" || metric.actualStatus === "submitted") {
        Object.assign(patch, { actualStatus: "draft", actualValidatorId: null });
      }
    }
    if (changed(actualKeys) && metric.actualStatus !== "draft") {
      Object.assign(patch, { actualStatus: "draft", actualValidatorId: null, financeStatus: "pending" });
    }

    const evidence = (v: unknown) => Array.isArray(v) && v.length > 0;
    if (body.action === "submitBaseline") {
      if (next.baselineValue === null || next.baselineValue === undefined || !next.baselinePeriod || !evidence(next.baselineEvidence)) {
        return NextResponse.json({ error: "Add the baseline value, the period it covers and at least one piece of evidence" }, { status: 400 });
      }
      patch.baselineStatus = "submitted";
    } else if (body.action === "submitActual") {
      const baselineOk = (patch.baselineStatus ?? metric.baselineStatus) === "validated";
      if (!baselineOk) return NextResponse.json({ error: "The baseline must be validated first" }, { status: 400 });
      if (next.actualValue === null || next.actualValue === undefined || !next.actualPeriod || !evidence(next.actualEvidence)) {
        return NextResponse.json({ error: "Add the actual value, the period it covers and at least one piece of evidence" }, { status: 400 });
      }
      patch.actualStatus = "submitted";
    }

    const [updated] = await db.update(impactMetrics).set(patch).where(eq(impactMetrics.id, id)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating metric:", error);
    return NextResponse.json({ error: "Failed to update metric" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await params;
    const c = await load(slug, id);
    if ("error" in c) return c.error;
    const { metric, eff } = c;
    const own = eff.access === "participant" && eff.teamId === metric.teamId;
    if (!(eff.access === "admin" || (own && metric.baselineStatus !== "validated"))) {
      return NextResponse.json({ error: "A validated metric can only be removed by an organiser" }, { status: 403 });
    }
    await db.delete(impactMetrics).where(eq(impactMetrics.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting metric:", error);
    return NextResponse.json({ error: "Failed to delete metric" }, { status: 500 });
  }
}
