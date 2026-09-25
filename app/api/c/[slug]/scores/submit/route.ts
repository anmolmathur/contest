import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, scores } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";
import { criteriaForPhase, validateCriteriaScores, type ScoringCriterion } from "@/lib/scoring";
import { parseOptionalText } from "@/lib/api-input";

// Legacy fixed field keys that map to dedicated (integer) columns
const LEGACY_FIELD_MAP: Record<string, string> = {
  aiUsageScore: "aiUsageScore",
  businessImpactScore: "businessImpactScore",
  uxScore: "uxScore",
  innovationScore: "innovationScore",
  executionScore: "executionScore",
};

/**
 * POST /api/c/[slug]/scores/submit
 *
 * Body: {
 *   submissionId: string,
 *   criteriaScores: Record<criterionKey, number>,   // each within contest.scoringScale
 *   feedback?: string | null,                       // shown to the team once results are published
 *   privateNote?: string | null,                    // jury-only, never shown to teams
 * }
 *
 * Upserts the caller's score for that submission (one per judge per
 * submission). Omitted feedback/privateNote leave existing values untouched
 * on update; null or "" clears them.
 *
 * 201 { message, score } on create, 200 { message, score } on update.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Write-guard: frozen contests (completed/archived) don't accept new scores.
    if (contest.status === "completed" || contest.status === "archived") {
      return NextResponse.json(
        { error: "Contest is completed or archived; scoring is frozen" },
        { status: 409 }
      );
    }

    // Verify user is a judge for this contest
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json(
        { error: "Only judges can submit scores" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const { submissionId, criteriaScores } = (body ?? {}) as {
      submissionId?: string;
      criteriaScores?: Record<string, unknown>;
    };

    // Validate required fields
    if (!submissionId || !criteriaScores || typeof criteriaScores !== "object" || Array.isArray(criteriaScores)) {
      return NextResponse.json(
        { error: "submissionId and criteriaScores are required" },
        { status: 400 }
      );
    }

    // Validate every value against the contest's scale (e.g. 0–100 or 1–10)
    const scaleError = validateCriteriaScores(criteriaScores, contest.scoringScale);
    if (scaleError) {
      return NextResponse.json({ error: scaleError }, { status: 400 });
    }

    const feedback = parseOptionalText(body.feedback, "Feedback");
    if (feedback.error !== undefined) {
      return NextResponse.json({ error: feedback.error }, { status: 400 });
    }
    const privateNote = parseOptionalText(body.privateNote, "Private note");
    if (privateNote.error !== undefined) {
      return NextResponse.json({ error: privateNote.error }, { status: 400 });
    }

    // Verify submission exists and belongs to this contest
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        team: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.team?.contestId !== contest.id) {
      return NextResponse.json(
        { error: "Submission does not belong to this contest" },
        { status: 400 }
      );
    }

    // Per-stage rubrics: only keep criteria that apply to this submission's stage.
    const stageCriteria = criteriaForPhase(
      (Array.isArray(contest.scoringCriteria) ? contest.scoringCriteria : []) as ScoringCriterion[],
      submission.phase,
    );
    if (stageCriteria.some((c) => c.phases && c.phases.length > 0)) {
      const allowed = new Set(stageCriteria.map((c) => c.key));
      for (const k of Object.keys(criteriaScores)) if (!allowed.has(k)) delete criteriaScores[k];
      if (Object.keys(criteriaScores).length === 0) {
        return NextResponse.json({ error: "No scores for this stage's criteria" }, { status: 400 });
      }
    }

    // Mirror legacy keys into the old integer columns for backward compatibility
    const legacyFields: Record<string, number> = {};
    for (const [criteriaKey, columnName] of Object.entries(LEGACY_FIELD_MAP)) {
      if (criteriaKey in criteriaScores) {
        legacyFields[columnName] = Math.round(criteriaScores[criteriaKey] as number);
      }
    }

    const textFields: { feedback?: string | null; privateNote?: string | null } = {};
    if (feedback.value !== undefined) textFields.feedback = feedback.value;
    if (privateNote.value !== undefined) textFields.privateNote = privateNote.value;

    // Check if judge already scored this submission
    const existingScore = await db.query.scores.findFirst({
      where: and(
        eq(scores.submissionId, submissionId),
        eq(scores.judgeId, session.user.id)
      ),
    });

    if (existingScore) {
      const [updatedScore] = await db
        .update(scores)
        .set({
          criteriaScores,
          ...legacyFields,
          ...textFields,
          updatedAt: new Date(),
        })
        .where(eq(scores.id, existingScore.id))
        .returning();

      return NextResponse.json(
        { message: "Score updated successfully", score: updatedScore },
        { status: 200 }
      );
    }

    const [newScore] = await db
      .insert(scores)
      .values({
        submissionId,
        judgeId: session.user.id,
        criteriaScores,
        ...legacyFields,
        ...textFields,
      })
      .returning();

    return NextResponse.json(
      { message: "Score submitted successfully", score: newScore },
      { status: 201 }
    );
  } catch (error) {
    console.error("Score submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
