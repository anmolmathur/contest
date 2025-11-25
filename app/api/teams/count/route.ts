import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  try {
    const [result] = await db.select({ count: count() }).from(teams);
    return NextResponse.json({ count: result.count }, { status: 200 });
  } catch (error) {
    console.error("Team count error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

