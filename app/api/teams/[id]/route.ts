import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

