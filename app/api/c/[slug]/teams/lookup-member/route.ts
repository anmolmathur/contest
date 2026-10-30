import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";
import { isValidEmail, memberStatus } from "@/lib/team-members";

/**
 * POST /api/c/[slug]/teams/lookup-member
 * Body: { email: string }
 *
 * Lets the team form show who a teammate's email belongs to before saving.
 * Open to this contest's participants and admins only. POST keeps the email
 * out of URLs and access logs.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const contestUser = await getContestUser(session.user.id, contest.id);
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (contestUser?.role !== "participant" && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    return NextResponse.json(await memberStatus(contest.id, email));
  } catch (error) {
    console.error("Member lookup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
