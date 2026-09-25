import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, getContestUser } from "@/lib/contest-auth";
import {
  resolveSubmissionFields,
  validateSubmission,
  legacyColumnsFrom,
  submissionValues,
} from "@/lib/submission-fields";
import { scorablePhases } from "@/lib/scoring";
import { submissionBlocker } from "@/lib/stage-gates";
import {
  extractSubmissionInput,
  parsePhase,
  usesLegacySubmissionColumns,
  contestTerm,
} from "@/lib/api-input";

/**
 * POST /api/c/[slug]/submissions/create
 *
 * Body: { phase: number, fields: Record<string, string | string[]> }
 *   (legacy flat body `{ phase, githubUrl, demoUrl, ... }` is still accepted)
 *
 * Upserts the caller's team submission for that phase. Only phases with
 * maxPoints > 0 accept submissions. Values are validated against the
 * contest's `submissionFields` (legacy hackathon fields when unset).
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

    if (contest.status === "completed" || contest.status === "archived") {
      return NextResponse.json(
        { error: "This contest is closed; submissions are no longer accepted" },
        { status: 409 }
      );
    }

    // Get the user's contest membership
    const contestUser = await getContestUser(session.user.id, contest.id);
    if (!contestUser || !contestUser.teamId) {
      return NextResponse.json(
        { error: `You must be in a ${contestTerm(contest, "team").toLowerCase()} for this contest to submit` },
        { status: 400 }
      );
    }
    if (contestUser.role === "mentor") {
      return NextResponse.json(
        { error: "Mentors cannot submit on behalf of a team" },
        { status: 403 }
      );
    }

    // Verify the team belongs to this contest
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, contestUser.teamId),
        eq(teams.contestId, contest.id)
      ),
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found in this contest" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const phase = parsePhase((body as Record<string, unknown>).phase);
    const phaseWord = contestTerm(contest, "phase");

    // Validate phase against contest phaseConfig (only scorable phases accept submissions)
    const validPhases = scorablePhases(contest.phaseConfig).map((p) => p.phase);
    if (phase === null || !validPhases.includes(phase)) {
      return NextResponse.json(
        {
          error: `Invalid ${phaseWord.toLowerCase()}. Valid submission ${phaseWord.toLowerCase()}s for this contest: ${validPhases.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Elimination, gate decisions, crew composition, validated metrics.
    const blocker = await submissionBlocker(contest, team, phase);
    if (blocker) {
      return NextResponse.json({ error: blocker }, { status: 400 });
    }

    const fieldDefs = resolveSubmissionFields(contest.submissionFields);
    const teamPaths = Array.isArray(team.solutionPaths) ? (team.solutionPaths as string[]) : null;
    const result = validateSubmission(fieldDefs, extractSubmissionInput(body), phase, teamPaths);
    if (result.error !== undefined) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const values = result.values;

    // Declared solution paths live on the team too (drives path-conditional fields).
    if (Array.isArray(values.solutionPaths)) {
      await db
        .update(teams)
        .set({ solutionPaths: values.solutionPaths, updatedAt: new Date() })
        .where(eq(teams.id, team.id));
    }
    const legacy = usesLegacySubmissionColumns(contest) ? legacyColumnsFrom(values) : {};

    // Check if a submission already exists for this team and phase
    const existingSubmission = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.teamId, team.id),
        eq(submissions.phase, phase)
      ),
    });

    if (existingSubmission) {
      const [updatedSubmission] = await db
        .update(submissions)
        .set({ fields: values, ...legacy, updatedAt: new Date() })
        .where(eq(submissions.id, existingSubmission.id))
        .returning();

      return NextResponse.json(
        {
          message: "Submission updated successfully",
          submission: { ...updatedSubmission, values: submissionValues(updatedSubmission) },
          updated: true,
        },
        { status: 200 }
      );
    }

    const [newSubmission] = await db
      .insert(submissions)
      .values({ teamId: team.id, phase, fields: values, ...legacy })
      .returning();

    return NextResponse.json(
      {
        message: "Submission created successfully",
        submission: { ...newSubmission, values: submissionValues(newSubmission) },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Submission creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
