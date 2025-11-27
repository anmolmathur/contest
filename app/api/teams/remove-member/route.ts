import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, teams, submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { JUDGE_EMAILS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, teamId } = body;

    if (!userId || !teamId) {
      return NextResponse.json(
        { error: "Missing required fields: userId and teamId" },
        { status: 400 }
      );
    }

    // Get the team
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is creator or admin (judge)
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = JUDGE_EMAILS.includes(session.user.email || "");

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

    // Verify the user is actually in this team
    const userToRemove = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userToRemove) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userToRemove.teamId !== teamId) {
      return NextResponse.json(
        { error: "User is not a member of this team" },
        { status: 400 }
      );
    }

    // Remove user from team
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

