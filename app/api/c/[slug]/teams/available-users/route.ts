import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";

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

    // Get users assigned to this contest but not in a team
    // (contest_users.teamId IS NULL and role = 'participant')
    const availableUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        department: users.department,
        participantRole: contestUsers.participantRole,
      })
      .from(contestUsers)
      .innerJoin(users, eq(contestUsers.userId, users.id))
      .where(
        and(
          eq(contestUsers.contestId, contest.id),
          isNull(contestUsers.teamId),
          eq(contestUsers.role, "participant"),
        )
      );

    return NextResponse.json({ users: availableUsers }, { status: 200 });
  } catch (error) {
    console.error("Available users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
