import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { JUDGE_EMAILS } from "@/lib/constants";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isPlatformAdmin } from "@/lib/contest-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a platform admin or legacy judge
    const isAdmin = await isPlatformAdmin(session.user.id);
    if (!isAdmin && !JUDGE_EMAILS.includes(session.user.email || "")) {
      return NextResponse.json(
        { error: "Only admins can create users" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, password, role, globalRole, department } = body;

    // Validate required fields — accept either role (legacy) or globalRole (new platform admin form)
    if (!name || !email || !password || (!role && !globalRole)) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, password, and role are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

