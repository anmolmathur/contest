import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { legacyAuthz, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

export async function POST(req: NextRequest) {
  try {
    const az = await legacyAuthz();
    if (!az.canRead) throw new LegacyAuthError(403, "Join the contest first");
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen; submissions are closed");

    const body = await req.json();
    const {
      phase,
      githubUrl,
      demoUrl,
      submissionDescription,
      aiPromptsUsed,
      aiToolsUtilized,
      aiScreenshots,
    } = body;

    if (
      !phase ||
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

    if (![2, 3, 4].includes(phase)) {
      return NextResponse.json({ error: "Phase must be 2, 3, or 4" }, { status: 400 });
    }

    // Look up the caller's contest_users row to find their team
    const cu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.userId, az.userId),
      ),
    });

    if (!cu?.teamId) {
      return NextResponse.json(
        { error: "You must be in a team to submit" },
        { status: 400 }
      );
    }

    const existingSubmission = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.teamId, cu.teamId),
        eq(submissions.phase, phase)
      ),
    });

    if (existingSubmission) {
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
        .where(eq(submissions.id, existingSubmission.id))
        .returning();

      return NextResponse.json(
        {
          message: "Submission updated successfully",
          submission: updatedSubmission,
          updated: true,
        },
        { status: 200 }
      );
    }

    const [newSubmission] = await db
      .insert(submissions)
      .values({
        teamId: cu.teamId,
        phase,
        githubUrl,
        demoUrl,
        submissionDescription,
        aiPromptsUsed,
        aiToolsUtilized,
        aiScreenshots,
      })
      .returning();

    return NextResponse.json(
      { message: "Submission created successfully", submission: newSubmission },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
