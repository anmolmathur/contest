import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      phase,
      githubUrl,
      demoUrl,
      aiPromptsUsed,
      aiToolsUtilized,
      aiScreenshots,
    } = body;

    // Validate required fields
    if (
      !phase ||
      !githubUrl ||
      !demoUrl ||
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

    // Validate phase
    if (![2, 3, 4].includes(phase)) {
      return NextResponse.json(
        { error: "Phase must be 2, 3, or 4" },
        { status: 400 }
      );
    }

    // Check if user has a team
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user?.teamId) {
      return NextResponse.json(
        { error: "You must be in a team to submit" },
        { status: 400 }
      );
    }

    // Create submission
    const [newSubmission] = await db
      .insert(submissions)
      .values({
        teamId: user.teamId,
        phase,
        githubUrl,
        demoUrl,
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
    console.error("Submission creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

