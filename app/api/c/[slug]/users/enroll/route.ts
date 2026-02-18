import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";

// POST /api/c/[slug]/users/enroll - Self-enroll into an active contest as participant
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Only allow self-enrollment into active contests
    if (contest.status !== "active") {
      return NextResponse.json(
        { error: "Contest is not currently active" },
        { status: 400 }
      );
    }

    // Check if user is already enrolled
    const existing = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.userId, session.user.id),
      ),
    });

    if (existing) {
      // Already enrolled — return the existing record (not an error)
      return NextResponse.json(existing);
    }

    // Enroll as participant
    const [newContestUser] = await db
      .insert(contestUsers)
      .values({
        contestId: contest.id,
        userId: session.user.id,
        role: "participant",
      })
      .returning();

    return NextResponse.json(newContestUser, { status: 201 });
  } catch (error) {
    console.error("Error self-enrolling in contest:", error);
    return NextResponse.json(
      { error: "Failed to enroll in contest" },
      { status: 500 }
    );
  }
}
