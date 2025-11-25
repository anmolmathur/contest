import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, teams } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

const ROLE_LIMITS = {
  Developer: 3,
  "Technical Lead": 1,
  "Product Owner": 1,
  "Business SPOC": 1,
  QA: 0,
  Intern: 1,
};

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
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the requesting user is the team creator
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (team.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: "Only team creator can add members" },
        { status: 403 }
      );
    }

    // Check if user to be added exists and is available
    const userToAdd = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userToAdd) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userToAdd.teamId) {
      return NextResponse.json(
        { error: "User is already in a team" },
        { status: 400 }
      );
    }

    // Get current team members
    const teamMembers = await db.query.users.findMany({
      where: eq(users.teamId, teamId),
    });

    // Check team size limit (max 6 members)
    if (teamMembers.length >= 6) {
      return NextResponse.json(
        { error: "Team is full (maximum 6 members)" },
        { status: 400 }
      );
    }

    // Count current roles
    const roleCounts: Record<string, number> = {};
    teamMembers.forEach((member) => {
      if (member.role) {
        roleCounts[member.role] = (roleCounts[member.role] || 0) + 1;
      }
    });

    // Check if adding this user would exceed role limits
    const newUserRole = userToAdd.role;
    if (newUserRole) {
      const currentCount = roleCounts[newUserRole] || 0;
      const limit = ROLE_LIMITS[newUserRole as keyof typeof ROLE_LIMITS];
      if (limit !== undefined && currentCount >= limit) {
        return NextResponse.json(
          {
            error: `Maximum ${limit} ${newUserRole}(s) allowed in a team`,
          },
          { status: 400 }
        );
      }
    }

    // Add user to team
    await db.update(users).set({ teamId }).where(eq(users.id, userId));

    return NextResponse.json(
      { message: "Member added successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

