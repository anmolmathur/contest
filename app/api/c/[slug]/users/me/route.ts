import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, isPlatformAdmin } from "@/lib/contest-auth";

// GET /api/c/[slug]/users/me - Get current user's contest membership
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

    const contestUser = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.userId, session.user.id),
      ),
    });

    const platformAdmin = await isPlatformAdmin(session.user.id);

    if (!contestUser && !platformAdmin) {
      return NextResponse.json({ error: "Not enrolled in this contest" }, { status: 404 });
    }

    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { id: true, name: true, email: true, image: true, globalRole: true, department: true, userType: true },
    });

    // Platform admins administer every contest — surface them as admin even
    // without a contest_users row (virtual membership, never auto-enrolled).
    if (!contestUser) {
      return NextResponse.json({
        id: "",
        contestId: contest.id,
        userId: session.user.id,
        role: "admin",
        participantRole: null,
        teamId: null,
        platformOverride: true,
        user,
      });
    }

    return NextResponse.json({
      ...contestUser,
      role: platformAdmin ? "admin" : contestUser.role,
      platformOverride: platformAdmin && contestUser.role !== "admin",
      user,
    });
  } catch (error) {
    console.error("Error fetching contest user:", error);
    return NextResponse.json({ error: "Failed to fetch contest user" }, { status: 500 });
  }
}
