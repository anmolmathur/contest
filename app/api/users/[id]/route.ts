import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { JUDGE_EMAILS } from "@/lib/constants";
import { db } from "@/lib/db";
import { users, teams, scores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isPlatformAdmin } from "@/lib/contest-auth";

// GET - Get a specific user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a platform admin or legacy judge
    const isAdmin = await isPlatformAdmin(session.user.id);
    if (!isAdmin && !JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only admins can access this" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        team: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        globalRole: user.globalRole,
        department: user.department,
        teamId: user.teamId,
        teamName: user.team?.name || null,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a specific user
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a platform admin or legacy judge
    const isAdmin = await isPlatformAdmin(session.user.id);
    if (!isAdmin && !JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only admins can update users" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { name, email, password, role, globalRole, department, teamId } = body;

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If email is being changed, check it's not taken
    if (email && email !== existingUser.email) {
      const emailExists = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (emailExists) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (globalRole !== undefined) updateData.globalRole = globalRole;
    if (department !== undefined) updateData.department = department || null;
    if (teamId !== undefined) updateData.teamId = teamId || null;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return NextResponse.json({
      message: "User updated successfully",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        globalRole: updatedUser.globalRole,
        department: updatedUser.department,
        teamId: updatedUser.teamId,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a platform admin or legacy judge
    const isAdmin = await isPlatformAdmin(session.user.id);
    if (!isAdmin && !JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only admins can delete users" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is a team creator - if so, prevent deletion
    const createdTeam = await db.query.teams.findFirst({
      where: eq(teams.createdBy, id),
    });

    if (createdTeam) {
      return NextResponse.json(
        { error: "Cannot delete user who created a team. Delete the team first." },
        { status: 400 }
      );
    }

    // Delete the user (cascade will handle related records)
    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
