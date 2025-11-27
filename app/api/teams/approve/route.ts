import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq, count, and } from "drizzle-orm";
import { JUDGE_EMAILS, MAX_APPROVED_TEAMS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a judge
    if (!JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only judges can approve teams" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { teamId, approved } = body;

    if (!teamId || typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // If approving a team, check if the limit has been reached
    if (approved) {
      const [approvedCountResult] = await db
        .select({ count: count() })
        .from(teams)
        .where(eq(teams.approved, true));

      if (approvedCountResult.count >= MAX_APPROVED_TEAMS) {
        return NextResponse.json(
          { error: `Maximum approved team limit (${MAX_APPROVED_TEAMS}) reached` },
          { status: 400 }
        );
      }
    }

    // Update team approval status
    const [updatedTeam] = await db
      .update(teams)
      .set({ 
        approved,
        updatedAt: new Date()
      })
      .where(eq(teams.id, teamId))
      .returning();

    if (!updatedTeam) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: `Team ${approved ? "approved" : "unapproved"} successfully`, 
        team: updatedTeam 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Team approval error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

