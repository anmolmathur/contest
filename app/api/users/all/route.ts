import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/contest-auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isPlatformAdmin(session.user.id))) {
      return NextResponse.json(
        { error: "Only platform admins can list all users" },
        { status: 403 }
      );
    }

    // Get all users with their team information
    const allUsers = await db.query.users.findMany({
      with: {
        team: true,
      },
    });

    // Format the response
    const formattedUsers = allUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      globalRole: user.globalRole,
      department: user.department,
      teamId: user.teamId,
      teamName: user.team?.name || null,
      isTeamLeader: user.team?.leaderId === user.id,
      createdAt: user.createdAt,
    }));

    return NextResponse.json({ users: formattedUsers }, { status: 200 });
  } catch (error) {
    console.error("Get all users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
