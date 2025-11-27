import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";

export async function GET() {
  try {
    // Get total count of all teams
    const [teamCountResult] = await db.select({ count: count() }).from(teams);
    
    // Get count of approved teams
    const [approvedCountResult] = await db
      .select({ count: count() })
      .from(teams)
      .where(eq(teams.approved, true));

    return NextResponse.json(
      { 
        count: teamCountResult.count,
        approvedCount: approvedCountResult.count
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Team count error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
