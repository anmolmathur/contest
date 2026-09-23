import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { userTypeForEmail } from "@/lib/user-type";

const LEGACY_ROLES = ["Developer", "Technical Lead", "Product Owner", "Business SPOC", "QA", "Intern"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, password, role, department } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // Role is no longer required: the per-contest role is chosen when joining a team.
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existingUser = await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${email}`,
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in, or use 'Forgot password'." },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userType = userTypeForEmail(email);

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        // Legacy enum column: only store values it accepts.
        role: (LEGACY_ROLES as readonly string[]).includes(role) ? role : null,
        department: department || (userType === "internal" ? "TeamLease" : null),
        userType,
      })
      .returning();

    return NextResponse.json(
      { message: "User created successfully", userId: newUser.id, userType },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
