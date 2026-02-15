import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, contests, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

// DELETE /api/c/[slug]/users/[id] - Remove a user from a contest (admin only)
// [id] is the contestUsers record ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const canAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canAdmin) {
      return NextResponse.json({ error: "Only contest admins can remove users" }, { status: 403 });
    }

    // Find the contest user record
    const contestUser = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.id, id),
        eq(contestUsers.contestId, contest.id),
      ),
    });

    if (!contestUser) {
      return NextResponse.json({ error: "Contest user not found" }, { status: 404 });
    }

    // Prevent admins from removing themselves (to avoid orphaned contests)
    if (contestUser.userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the contest" },
        { status: 400 }
      );
    }

    await db.delete(contestUsers).where(
      and(
        eq(contestUsers.id, id),
        eq(contestUsers.contestId, contest.id),
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing user from contest:", error);
    return NextResponse.json({ error: "Failed to remove user from contest" }, { status: 500 });
  }
}
