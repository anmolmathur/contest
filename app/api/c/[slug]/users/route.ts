import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, contests, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest, canJudgeContest } from "@/lib/contest-auth";

// GET /api/c/[slug]/users - List all users in a contest with their roles (admin/judge only)
export async function GET(
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

    // Only admins and judges can list all users
    const canView = await canJudgeContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canView) {
      return NextResponse.json({ error: "Only admins and judges can view contest users" }, { status: 403 });
    }

    const contestUsersList = await db
      .select({
        id: contestUsers.id,
        contestId: contestUsers.contestId,
        userId: contestUsers.userId,
        role: contestUsers.role,
        participantRole: contestUsers.participantRole,
        teamId: contestUsers.teamId,
        createdAt: contestUsers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          globalRole: users.globalRole,
        },
      })
      .from(contestUsers)
      .innerJoin(users, eq(contestUsers.userId, users.id))
      .where(eq(contestUsers.contestId, contest.id));

    return NextResponse.json(contestUsersList);
  } catch (error) {
    console.error("Error fetching contest users:", error);
    return NextResponse.json({ error: "Failed to fetch contest users" }, { status: 500 });
  }
}
