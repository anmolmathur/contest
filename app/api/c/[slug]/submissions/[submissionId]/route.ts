import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, contestUsers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { resolveContest, canJudgeContest, getContestUser } from "@/lib/contest-auth";
import {
  resolveSubmissionFields,
  validateSubmission,
  legacyColumnsFrom,
  submissionValues,
} from "@/lib/submission-fields";
import { extractSubmissionInput, usesLegacySubmissionColumns } from "@/lib/api-input";

/** Judges + contest admins (same denominator as submissions/all). */
// Jury size = contest users with role "judge". Admins can also score but are
// organisers, so they only count when a contest has no dedicated judges.
async function countJudges(contestId: string): Promise<number> {
  const rows = await db.query.contestUsers.findMany({
    where: and(eq(contestUsers.contestId, contestId), inArray(contestUsers.role, ["judge", "admin"])),
    columns: { id: true, role: true },
  });
  const judges = rows.filter((r) => r.role === "judge").length;
  return judges || rows.length || 1;
}

// GET - Fetch submission details
//
// Judges/admins get full scores (incl. feedback + private notes).
// Team members get the submission plus scoring progress only
// (`scoresCount`, `totalJudges`, and `scores: [{ id }]`) — never judge
// identities, criteria scores, feedback or private notes. Teams read jury
// feedback through /teams/[id]/feedback once results are published.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, submissionId } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        team: true,
        scores: {
          with: {
            judge: { columns: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Verify submission belongs to this contest
    if (submission.team?.contestId !== contest.id) {
      return NextResponse.json(
        { error: "Submission not found in this contest" },
        { status: 404 }
      );
    }

    // Check if user is authorized (team member in this contest or judge)
    const contestUser = await getContestUser(session.user.id, contest.id);
    const isTeamMember = contestUser?.teamId === submission.teamId;
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );

    if (!isTeamMember && !isJudge) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const totalJudges = await countJudges(contest.id);
    const values = submissionValues(submission);
    const scoresCount = submission.scores.length;

    if (isJudge) {
      return NextResponse.json(
        { submission: { ...submission, values, scoresCount, totalJudges } },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        submission: {
          ...submission,
          values,
          scores: submission.scores.map((s) => ({ id: s.id })),
          scoresCount,
          totalJudges,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update submission (team members or judges)
//
// Body: { fields: Record<string, string | string[]> }
//   (legacy flat body `{ githubUrl, demoUrl, ... }` is still accepted)
// The phase is fixed by the existing submission.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, submissionId } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Get the submission
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

    // Verify submission belongs to this contest
    if (submission.team?.contestId !== contest.id) {
      return NextResponse.json(
        { error: "Submission not found in this contest" },
        { status: 404 }
      );
    }

    // Check if user is a team member (not a mentor) or a judge
    const contestUser = await getContestUser(session.user.id, contest.id);
    const isTeamMember =
      contestUser?.teamId === submission.teamId && contestUser?.role !== "mentor";
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );

    if (!isTeamMember && !isJudge) {
      return NextResponse.json(
        { error: "Only team members or judges can edit submissions" },
        { status: 403 }
      );
    }

    if (!isJudge && (contest.status === "completed" || contest.status === "archived")) {
      return NextResponse.json(
        { error: "This contest is closed; submissions can no longer be edited" },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const fieldDefs = resolveSubmissionFields(contest.submissionFields);
    const result = validateSubmission(fieldDefs, extractSubmissionInput(body), submission.phase);
    if (result.error !== undefined) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const values = result.values;
    const legacy = usesLegacySubmissionColumns(contest) ? legacyColumnsFrom(values) : {};

    const [updatedSubmission] = await db
      .update(submissions)
      .set({ fields: values, ...legacy, updatedAt: new Date() })
      .where(eq(submissions.id, submissionId))
      .returning();

    return NextResponse.json(
      {
        message: "Submission updated successfully",
        submission: { ...updatedSubmission, values: submissionValues(updatedSubmission) },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete submission (judge only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, submissionId } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Only judges/admins can delete submissions
    const isJudge = await canJudgeContest(
      session.user.id,
      contest.id,
      session.user.email ?? undefined
    );
    if (!isJudge) {
      return NextResponse.json(
        { error: "Only judges can delete submissions" },
        { status: 403 }
      );
    }

    // Check if submission exists and belongs to this contest
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
        { error: "Submission not found in this contest" },
        { status: 404 }
      );
    }

    // Delete the submission (cascade will delete related scores)
    await db.delete(submissions).where(eq(submissions.id, submissionId));

    return NextResponse.json(
      { message: "Submission deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
