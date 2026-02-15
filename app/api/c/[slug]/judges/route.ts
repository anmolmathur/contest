import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, contests, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";

// GET /api/c/[slug]/judges - List judges for a contest (public within contest)
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

    // Any authenticated user who knows the contest slug can view judges
    // This is "public within contest" - no role restriction required
    const judges = await db
      .select({
        id: contestUsers.id,
        userId: contestUsers.userId,
        role: contestUsers.role,
        createdAt: contestUsers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(contestUsers)
      .innerJoin(users, eq(contestUsers.userId, users.id))
      .where(
        and(
          eq(contestUsers.contestId, contest.id),
          eq(contestUsers.role, "judge"),
        )
      );

    return NextResponse.json(judges);
  } catch (error) {
    console.error("Error fetching contest judges:", error);
    return NextResponse.json({ error: "Failed to fetch contest judges" }, { status: 500 });
  }
}
