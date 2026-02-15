import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, submissions, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";

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

    const body = await req.json();
    const { userId, teamId } = body;

    if (!userId || !teamId) {
      return NextResponse.json(
        { error: "Missing required fields: userId and teamId" },
        { status: 400 }
      );
    }

    // Get the team (scoped to this contest)
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, teamId), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is creator or admin
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only team creator or admin can remove members" },
        { status: 403 }
      );
    }

    // Check if the user to remove is the team creator
    if (userId === team.createdBy) {
      return NextResponse.json(
        { error: "Cannot remove the team creator. Delete the team instead." },
        { status: 400 }
      );
    }

    // Check if team has any submissions (only allow removal before submission for non-admins)
    if (!isAdmin) {
      const teamSubmissions = await db.query.submissions.findMany({
        where: eq(submissions.teamId, teamId),
      });

      if (teamSubmissions.length > 0) {
        return NextResponse.json(
          { error: "Cannot remove members after submissions have been made" },
          { status: 400 }
        );
      }
    }

    // Verify the user is actually in this team via contest_users
    const targetContestUser = await getContestUser(userId, contest.id);
    if (!targetContestUser || targetContestUser.teamId !== teamId) {
      return NextResponse.json(
        { error: "User is not a member of this team" },
        { status: 400 }
      );
    }

    // Clear contest_users.teamId
    await db
      .update(contestUsers)
      .set({ teamId: null })
      .where(eq(contestUsers.id, targetContestUser.id));

    // Clear users.teamId for backward compat
    await db
      .update(users)
      .set({ teamId: null })
      .where(eq(users.id, userId));

    return NextResponse.json({
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
