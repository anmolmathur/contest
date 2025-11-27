import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { JUDGE_EMAILS } from "@/lib/constants";

// GET - Fetch submission details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { submissionId } = await params;

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

    // Check if user is authorized (team member or judge)
    const isTeamMember = session.user.teamId === submission.teamId;
    const isJudge = JUDGE_EMAILS.includes(session.user.email || "");

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

// PUT - Update submission (team members only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { submissionId } = await params;

    // Get the submission
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Check if user is a team member or a judge (admin)
    const isTeamMember = session.user.teamId === submission.teamId;
    const isJudge = JUDGE_EMAILS.includes(session.user.email || "");

    if (!isTeamMember && !isJudge) {
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
      { message: "Submission updated successfully", submission: updatedSubmission },
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

// DELETE - Delete submission (admin/judges only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only judges/admins can delete submissions
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only admins can delete submissions" },
        { status: 403 }
      );
    }

    const { submissionId } = await params;

    // Check if submission exists
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
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

