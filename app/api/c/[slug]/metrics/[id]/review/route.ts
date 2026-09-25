import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { impactMetrics } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { canValidateContest, resolveContest } from "@/lib/contest-auth";

/**
 * POST /api/c/[slug]/metrics/[id]/review — Auditor decision.
 *   Body: { target: "baseline" | "actual", decision: "validated" | "rejected", note? }
 *         (Data scope; the item must be "submitted")
 *     or  { target: "finance", decision: "validated" | "rejected", note?,
 *           realisedValueInr, recurringAnnualValueInr, recurringYears (1–3), valuationBasis }
 *         (Finance scope; the actual must be validated)
 *   Rejections need a note so the team knows what to fix.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { slug, id } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (contest.status === "completed" || contest.status === "archived") {
      return NextResponse.json({ error: "This contest is closed" }, { status: 409 });
    }
    const metric = await db.query.impactMetrics.findFirst({
      where: and(eq(impactMetrics.id, id), eq(impactMetrics.contestId, contest.id)),
    });
    if (!metric) return NextResponse.json({ error: "Metric not found" }, { status: 404 });

    const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const target = b.target;
    const decision = b.decision;
    const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
    if (target !== "baseline" && target !== "actual" && target !== "finance") {
      return NextResponse.json({ error: "target must be baseline, actual or finance" }, { status: 400 });
    }
    if (decision !== "validated" && decision !== "rejected") {
      return NextResponse.json({ error: "decision must be validated or rejected" }, { status: 400 });
    }
    if (decision === "rejected" && !note) {
      return NextResponse.json({ error: "Tell the team what to fix" }, { status: 400 });
    }
    const scope = target === "finance" ? "Finance" : "Data";
    if (!(await canValidateContest(session.user.id, contest.id, scope))) {
      return NextResponse.json({ error: `Only ${scope} Auditors can review this` }, { status: 403 });
    }
    const now = new Date();

    if (target === "baseline" || target === "actual") {
      const status = target === "baseline" ? metric.baselineStatus : metric.actualStatus;
      if (status !== "submitted" && status !== "validated") {
        return NextResponse.json({ error: `The ${target} hasn't been submitted yet` }, { status: 400 });
      }
      const patch =
        target === "baseline"
          ? { baselineStatus: decision, baselineValidatorId: session.user.id, baselineNote: note, updatedAt: now }
          : { actualStatus: decision, actualValidatorId: session.user.id, actualNote: note, updatedAt: now };
      const [updated] = await db.update(impactMetrics).set(patch).where(eq(impactMetrics.id, id)).returning();
      return NextResponse.json(updated);
    }

    // Finance valuation
    if (metric.actualStatus !== "validated") {
      return NextResponse.json({ error: "Validate the actual numbers before valuing them" }, { status: 400 });
    }
    const int = (v: unknown) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? n : NaN;
    };
    const realised = int(b.realisedValueInr);
    const recurring = int(b.recurringAnnualValueInr);
    const years = int(b.recurringYears ?? 1);
    if ([realised, recurring, years].some((n) => Number.isNaN(n))) {
      return NextResponse.json({ error: "Values must be whole rupees" }, { status: 400 });
    }
    if (years !== null && (years < 0 || years > 3)) {
      return NextResponse.json({ error: "Recurring value counts for 0–3 years" }, { status: 400 });
    }
    if (decision === "validated" && realised === null && recurring === null) {
      return NextResponse.json({ error: "Enter the realised and/or recurring value" }, { status: 400 });
    }
    const [updated] = await db
      .update(impactMetrics)
      .set({
        realisedValueInr: realised,
        recurringAnnualValueInr: recurring,
        recurringYears: years ?? 1,
        valuationBasis: typeof b.valuationBasis === "string" ? b.valuationBasis.trim().slice(0, 2000) || null : metric.valuationBasis,
        financeStatus: decision,
        financeValidatorId: session.user.id,
        financeNote: note,
        updatedAt: now,
      })
      .where(eq(impactMetrics.id, id))
      .returning();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error reviewing metric:", error);
    return NextResponse.json({ error: "Failed to review metric" }, { status: 500 });
  }
}
