import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, contests, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, getContestUser } from "@/lib/contest-auth";

interface PhaseConfigEntry {
  phase: number;
  name: string;
  maxPoints: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  details?: string[];
  deliverables?: string[];
}

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

    // Get the user's contest membership
    const contestUser = await getContestUser(session.user.id, contest.id);
    if (!contestUser || !contestUser.teamId) {
      return NextResponse.json(
        { error: "You must be in a team for this contest to submit" },
        { status: 400 }
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

    // Validate required fields
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

    // Validate phase against contest phaseConfig
    const phaseConfig = (contest.phaseConfig as PhaseConfigEntry[]) || [];
    const validPhases = phaseConfig
      .filter((p) => p.maxPoints > 0)
      .map((p) => p.phase);

    if (!validPhases.includes(phase)) {
      return NextResponse.json(
        {
          error: `Invalid phase. Valid submission phases for this contest: ${validPhases.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check if a submission already exists for this team and phase
    const existingSubmission = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.teamId, team.id),
        eq(submissions.phase, phase)
      ),
    });

    if (existingSubmission) {
      // Update existing submission
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

    // Create new submission
    const [newSubmission] = await db
      .insert(submissions)
      .values({
        teamId: team.id,
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
    console.error("Submission creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
