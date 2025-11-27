import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { JUDGE_EMAILS } from "@/lib/constants";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only judges/admins can access all submissions
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only admins can access this" },
        { status: 403 }
      );
    }

    // Get all submissions with related data
    const allSubmissions = await db.query.submissions.findMany({
      with: {
        team: true,
        scores: {
          with: {
            judge: true,
          },
        },
      },
      orderBy: (submissions, { desc }) => [desc(submissions.submittedAt)],
    });

    // Format the response
    const formattedSubmissions = allSubmissions.map((submission) => ({
      id: submission.id,
      teamId: submission.teamId,
      teamName: submission.team?.name || "Unknown",
      track: submission.team?.track || "Unknown",
      phase: submission.phase,
      githubUrl: submission.githubUrl,
      demoUrl: submission.demoUrl,
      submissionDescription: submission.submissionDescription,
      aiPromptsUsed: submission.aiPromptsUsed,
      aiToolsUtilized: submission.aiToolsUtilized,
      aiScreenshots: submission.aiScreenshots,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt,
      wasEdited: submission.updatedAt && submission.submittedAt 
        ? new Date(submission.updatedAt).getTime() > new Date(submission.submittedAt).getTime() + 1000
        : false,
      scoresCount: submission.scores.length,
      totalJudges: JUDGE_EMAILS.length,
      isFullyScored: submission.scores.length >= JUDGE_EMAILS.length,
    }));

    return NextResponse.json({ submissions: formattedSubmissions }, { status: 200 });
  } catch (error) {
    console.error("Get all submissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

