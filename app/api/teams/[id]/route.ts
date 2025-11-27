import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { JUDGE_EMAILS } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, id),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get team members
    const members = await db.query.users.findMany({
      where: eq(users.teamId, id),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
    });

    return NextResponse.json({ team, members }, { status: 200 });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update team (creator or admin only, before submission)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, track } = body;

    // Get the team
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, id),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is creator or admin (judge)
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = JUDGE_EMAILS.includes(session.user.email || "");

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only team creator or admin can update the team" },
        { status: 403 }
      );
    }

    // Check if team has any submissions (only allow edits before submission for non-admins)
    if (!isAdmin) {
      const teamSubmissions = await db.query.submissions.findMany({
        where: eq(submissions.teamId, id),
      });

      if (teamSubmissions.length > 0) {
        return NextResponse.json(
          { error: "Cannot update team after submissions have been made" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined && name.trim() !== "") {
      updateData.name = name.trim();
    }
    if (track !== undefined) {
      updateData.track = track;
    }

    const [updatedTeam] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json({
      message: "Team updated successfully",
      team: updatedTeam,
    });
  } catch (error: any) {
    console.error("Update team error:", error);
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Team name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete team (creator or admin only, before submission)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the team
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, id),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is creator or admin (judge)
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = JUDGE_EMAILS.includes(session.user.email || "");

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only team creator or admin can delete the team" },
        { status: 403 }
      );
    }

    // Check if team has any submissions (only allow deletion before submission for non-admins)
    if (!isAdmin) {
      const teamSubmissions = await db.query.submissions.findMany({
        where: eq(submissions.teamId, id),
      });

      if (teamSubmissions.length > 0) {
        return NextResponse.json(
          { error: "Cannot delete team after submissions have been made" },
          { status: 400 }
        );
      }
    }

    // Remove team association from all members first
    await db
      .update(users)
      .set({ teamId: null })
      .where(eq(users.teamId, id));

    // Delete the team (cascade will handle submissions if any)
    await db.delete(teams).where(eq(teams.id, id));

    return NextResponse.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Delete team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

