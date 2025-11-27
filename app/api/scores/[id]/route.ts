import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { JUDGE_EMAILS } from "@/lib/constants";
import { db } from "@/lib/db";
import { scores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET - Get a specific score
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a judge
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only judges can access this" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const score = await db.query.scores.findFirst({
      where: eq(scores.id, id),
      with: {
        submission: {
          with: {
            team: true,
          },
        },
        judge: true,
      },
    });

    if (!score) {
      return NextResponse.json({ error: "Score not found" }, { status: 404 });
    }

    return NextResponse.json({
      score: {
        id: score.id,
        submissionId: score.submissionId,
        judgeId: score.judgeId,
        judgeName: score.judge?.name,
        teamName: score.submission?.team?.name,
        phase: score.submission?.phase,
        aiUsageScore: score.aiUsageScore,
        businessImpactScore: score.businessImpactScore,
        uxScore: score.uxScore,
        innovationScore: score.innovationScore,
        executionScore: score.executionScore,
        createdAt: score.createdAt,
        updatedAt: score.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a specific score
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a judge
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only judges can update scores" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      aiUsageScore,
      businessImpactScore,
      uxScore,
      innovationScore,
      executionScore,
    } = body;

    // Check if score exists
    const existingScore = await db.query.scores.findFirst({
      where: eq(scores.id, id),
    });

    if (!existingScore) {
      return NextResponse.json({ error: "Score not found" }, { status: 404 });
    }

    // Ownership check: Only the judge who created the score can update it
    if (existingScore.judgeId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own scores" },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: any = { updatedAt: new Date() };
    if (aiUsageScore !== undefined) updateData.aiUsageScore = aiUsageScore;
    if (businessImpactScore !== undefined) updateData.businessImpactScore = businessImpactScore;
    if (uxScore !== undefined) updateData.uxScore = uxScore;
    if (innovationScore !== undefined) updateData.innovationScore = innovationScore;
    if (executionScore !== undefined) updateData.executionScore = executionScore;

    // Validate score ranges
    const scoresToValidate = [
      updateData.aiUsageScore,
      updateData.businessImpactScore,
      updateData.uxScore,
      updateData.innovationScore,
      updateData.executionScore,
    ].filter((s) => s !== undefined);

    if (scoresToValidate.some((score) => score < 0 || score > 100)) {
      return NextResponse.json(
        { error: "Scores must be between 0 and 100" },
        { status: 400 }
      );
    }

    const [updatedScore] = await db
      .update(scores)
      .set(updateData)
      .where(eq(scores.id, id))
      .returning();

    return NextResponse.json({
      message: "Score updated successfully",
      score: updatedScore,
    });
  } catch (error) {
    console.error("Update score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific score
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a judge
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only judges can delete scores" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if score exists
    const score = await db.query.scores.findFirst({
      where: eq(scores.id, id),
    });

    if (!score) {
      return NextResponse.json({ error: "Score not found" }, { status: 404 });
    }

    // Delete the score
    await db.delete(scores).where(eq(scores.id, id));

    return NextResponse.json({ message: "Score deleted successfully" });
  } catch (error) {
    console.error("Delete score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

