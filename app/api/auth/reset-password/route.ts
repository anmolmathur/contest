import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { consumeResetToken } from "@/lib/auth/password-reset";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/auth/reset-password
 *
 * Body: { token: string, password: string }
 *
 * - Validates the token (must exist, unused, unexpired).
 * - Atomically marks it used.
 * - Bcrypt-hashes the new password and writes users.password.
 *
 * Returns 400 with a precise error code so the page can show a useful message
 * — unlike forgot-password, the user holds a token here so enumeration isn't
 * possible anyway. We do still avoid distinguishing "wrong token" from "user
 * deleted in the meantime"; both surface as `invalid_token`.
 */
export async function POST(req: NextRequest) {
  let token: string;
  let password: string;
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json(
      { error: "Missing token", code: "missing_token" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters", code: "weak_password" },
      { status: 400 },
    );
  }
  if (password.length > 200) {
    return NextResponse.json(
      { error: "Password too long", code: "weak_password" },
      { status: 400 },
    );
  }

  const result = await consumeResetToken(token);
  if (!result.ok) {
    const codeMap = {
      not_found: { msg: "This reset link is invalid.", status: 400 },
      expired: { msg: "This reset link has expired. Request a new one.", status: 400 },
      already_used: { msg: "This reset link has already been used.", status: 400 },
    } as const;
    const m = codeMap[result.reason];
    return NextResponse.json(
      { error: m.msg, code: result.reason },
      { status: m.status },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const updated = await db
    .update(users)
    .set({ password: passwordHash, updatedAt: new Date() })
    .where(eq(users.id, result.userId))
    .returning({ id: users.id, email: users.email });

  if (updated.length === 0) {
    // User was deleted between token validation and update — race window is
    // tiny but bound to happen eventually.
    return NextResponse.json(
      { error: "This reset link is invalid.", code: "not_found" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Password updated. You can now sign in.",
  });
}
