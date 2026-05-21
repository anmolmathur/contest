import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isPlatformAdmin } from "@/lib/contest-auth";

/**
 * Create a new user globally. This operates on the global user pool
 * (not contest-scoped) and is therefore restricted to platform admins.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isPlatformAdmin(session.user.id))) {
      return NextResponse.json(
        { error: "Only platform admins can create users" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, password, role, globalRole, department } = body;

    if (!name || !email || !password || (!role && !globalRole)) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, password, and role are required" },
        { status: 400 }
      );
    }

    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        role: role || null,
        globalRole: globalRole || "user",
        department: department || null,
      })
      .returning();

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          globalRole: newUser.globalRole,
          department: newUser.department,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin create user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
