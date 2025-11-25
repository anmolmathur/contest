import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNull } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get users without a team
    const availableUsers = await db.query.users.findMany({
      where: isNull(users.teamId),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
    });

    return NextResponse.json({ users: availableUsers }, { status: 200 });
  } catch (error) {
    console.error("Available users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

