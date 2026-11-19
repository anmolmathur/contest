import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contestUsers, contests, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { userTypeForEmail } from "@/lib/user-type";
import { parseMemberIdentifier } from "@/lib/member-identifier";
import { resolveHostToSlug } from "@/lib/tenant-resolver";
import { dispatchRegistrationConfirmed } from "@/lib/notifications/dispatch";

/**
 * The contest someone is signing up for: the custom domain they are on, else
 * the /c/<slug>/... page they will return to after login. Null when unknown.
 */
async function signupContest(req: NextRequest, callbackUrl: unknown) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let slug = await resolveHostToSlug(host).catch(() => null);
  if (!slug && typeof callbackUrl === "string") {
    const m = /^\/c\/([^/?#]+)/.exec(callbackUrl);
    if (m) slug = decodeURIComponent(m[1]);
  }
  if (!slug) return null;
  return (
    (await db.query.contests.findFirst({
      where: eq(contests.slug, slug),
      columns: { id: true, status: true, registrationDeadline: true },
    })) ?? null
  );
}

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
    const idInput = parseMemberIdentifier(body.memberIdentifier);
    if (idInput.error) {
      return NextResponse.json({ error: idInput.error }, { status: 400 });
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

    // Signing up from a contest with an Enrollment Number / Employee ID: enrol
    // them now so the ID is kept (the dashboard would otherwise enrol them on
    // first visit, without it). Same rules as /api/c/[slug]/users/enroll.
    if (idInput.value) {
      try {
        const contest = await signupContest(req, body.callbackUrl);
        const open =
          contest &&
          contest.status === "active" &&
          !(contest.registrationDeadline && new Date() > new Date(contest.registrationDeadline));
        if (contest && open) {
          const [enrolled] = await db
            .insert(contestUsers)
            .values({ contestId: contest.id, userId: newUser.id, role: "participant", memberIdentifier: idInput.value })
            .onConflictDoNothing()
            .returning({ id: contestUsers.id });
          if (enrolled) {
            dispatchRegistrationConfirmed({ contestId: contest.id, userId: newUser.id }).catch(() => {});
          }
        }
      } catch (e) {
        // The account exists; enrolment will happen on the first dashboard visit.
        console.warn("[register] contest enrolment with member ID failed:", e);
      }
    }

    return NextResponse.json(
      { message: "User created successfully", userId: newUser.id, userType },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
