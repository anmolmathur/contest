import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, contests, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";

// PUT /api/c/[slug]/users/[id]/role - Change a user's contest role (admin only)
// [id] is the contestUsers record ID
export async function PUT(
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
      return NextResponse.json({ error: "Only contest admins can change user roles" }, { status: 403 });
    }

    const body = await req.json();
    const { role, participantRole } = body;

    if (!role) {
      return NextResponse.json({ error: "role is required" }, { status: 400 });
    }

    const validRoles = ["admin", "judge", "participant"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
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

    // Prevent admins from demoting themselves
    if (contestUser.userId === session.user.id && role !== "admin") {
      return NextResponse.json(
        { error: "You cannot change your own admin role" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(contestUsers)
      .set({
        role,
        participantRole: role === "participant" ? (participantRole || null) : null,
      })
      .where(
        and(
          eq(contestUsers.id, id),
          eq(contestUsers.contestId, contest.id),
        )
      )
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating user role:", error);
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
  }
}
