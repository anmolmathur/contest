import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { MAX_TEAMS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, track } = body;

    if (!name || !track) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if team limit has been reached
    const [teamCountResult] = await db.select({ count: count() }).from(teams);
    if (teamCountResult.count >= MAX_TEAMS) {
      return NextResponse.json(
        { error: `Maximum team limit (${MAX_TEAMS}) reached` },
        { status: 400 }
      );
    }

    // Check if user already has a team
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (user?.teamId) {
      return NextResponse.json(
        { error: "You are already in a team" },
        { status: 400 }
      );
    }

    // Create team
    const [newTeam] = await db
      .insert(teams)
      .values({
        name,
        track,
        createdBy: session.user.id,
      })
      .returning();

    // Update user's teamId
    await db
      .update(users)
      .set({ teamId: newTeam.id })
      .where(eq(users.id, session.user.id));

    return NextResponse.json(
      { message: "Team created successfully", team: newTeam },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Team creation error:", error);
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

