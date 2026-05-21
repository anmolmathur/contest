import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireLegacyRead, requireLegacyJudge, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

/**
 * Ensure a submission actually belongs to the default contest and return its team info.
 * Throws LegacyAuthError on mismatch.
 */
async function loadSubmissionOrThrow(submissionId: string, defaultContestId: string) {
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    with: { team: true, scores: { with: { judge: true } } },
  });
  if (!submission) throw new LegacyAuthError(404, "Submission not found");
  if (submission.team?.contestId !== defaultContestId) {
    throw new LegacyAuthError(403, "Submission is not in your contest");
  }
  return submission;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const az = await requireLegacyRead();
    const { submissionId } = await params;
    const submission = await loadSubmissionOrThrow(submissionId, az.defaultContestId);

    // Determine team-membership via contest_users (not the deprecated users.teamId column)
    const cu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.userId, az.userId),
      ),
    });
    const isTeamMember = !!cu && cu.teamId === submission.teamId;

    if (!isTeamMember && !az.isJudge && !az.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ submission }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const az = await requireLegacyRead();
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is completed or archived; submissions are locked");

    const { submissionId } = await params;
    const submission = await loadSubmissionOrThrow(submissionId, az.defaultContestId);

    const cu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.userId, az.userId),
      ),
    });
    const isTeamMember = !!cu && cu.teamId === submission.teamId;

    if (!isTeamMember && !az.isJudge) {
      return NextResponse.json(
        { error: "Only team members or admins can edit submissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      githubUrl,
      demoUrl,
      submissionDescription,
      aiPromptsUsed,
      aiToolsUtilized,
      aiScreenshots,
    } = body;

    if (
      !githubUrl ||
      !demoUrl ||
      !submissionDescription ||
      !aiPromptsUsed ||
      !aiToolsUtilized ||
      !aiScreenshots ||
      aiScreenshots.length === 0
    ) {
      return NextResponse.json(
        { error: "All fields including AI evidence are required" },
        { status: 400 }
      );
    }

    const [updatedSubmission] = await db
      .update(submissions)
      .set({
        githubUrl,
        demoUrl,
        submissionDescription,
        aiPromptsUsed,
        aiToolsUtilized,
        aiScreenshots,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId))
      .returning();

    return NextResponse.json(
      { message: "Submission updated successfully", submission: updatedSubmission },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const az = await requireLegacyJudge();
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is completed or archived");

    const { submissionId } = await params;
    await loadSubmissionOrThrow(submissionId, az.defaultContestId);

    await db.delete(submissions).where(eq(submissions.id, submissionId));

    return NextResponse.json(
      { message: "Submission deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
