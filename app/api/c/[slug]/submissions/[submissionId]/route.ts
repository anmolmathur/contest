import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, scores, contests, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canJudgeContest, getContestUser } from "@/lib/contest-auth";

// GET - Fetch submission details
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
            judge: true,
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

    return NextResponse.json({ submission }, { status: 200 });
  } catch (error) {
    console.error("Get submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update submission (team members or judges)
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

    // Check if user is a team member or a judge
    const contestUser = await getContestUser(session.user.id, contest.id);
    const isTeamMember = contestUser?.teamId === submission.teamId;
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

    const body = await req.json();
    const {
      githubUrl,
      demoUrl,
      submissionDescription,
      aiPromptsUsed,
      aiToolsUtilized,
      aiScreenshots,
    } = body;

    // Validate required fields
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

    // Update submission
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
      {
        message: "Submission updated successfully",
        submission: updatedSubmission,
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
