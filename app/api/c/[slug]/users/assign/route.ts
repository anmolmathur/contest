import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, contests, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

// POST /api/c/[slug]/users/assign - Assign a user to a contest with a role (admin only)
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

    const canAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canAdmin) {
      return NextResponse.json({ error: "Only contest admins can assign users" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, role, participantRole } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }

    const validRoles = ["admin", "judge", "participant"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify the target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is already assigned to this contest
    const existing = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.userId, userId),
      ),
    });
    if (existing) {
      return NextResponse.json(
        { error: "User is already assigned to this contest" },
        { status: 409 }
      );
    }

    const [newContestUser] = await db.insert(contestUsers).values({
      contestId: contest.id,
      userId,
      role,
      participantRole: role === "participant" ? (participantRole || null) : null,
    }).returning();

    return NextResponse.json(newContestUser, { status: 201 });
  } catch (error) {
    console.error("Error assigning user to contest:", error);
    return NextResponse.json({ error: "Failed to assign user to contest" }, { status: 500 });
  }
}
