import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, users, teams } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { resolveContest, isPlatformAdmin } from "@/lib/contest-auth";
import { resolveSettings } from "@/lib/contest-config";
import { checkTeamSlot, roleConfigOf } from "@/lib/team-capacity";

/**
 * Track/category ids already claimed by a team. Only computed when the
 * contest has `settings.exclusiveTracks` on (otherwise an empty list), so the
 * dashboard can grey out taken options in its track select.
 */
async function takenTrackIdsFor(contest: { id: string; settings: unknown }): Promise<string[]> {
  if (!resolveSettings(contest.settings).exclusiveTracks) return [];
  const rows = await db.query.teams.findMany({
    where: and(eq(teams.contestId, contest.id), isNotNull(teams.trackId)),
    columns: { trackId: true },
  });
  return [...new Set(rows.map((r) => r.trackId).filter((x): x is string => !!x))];
}

// GET /api/c/[slug]/users/me - Get current user's contest membership
//
// Response: contest_users row fields + { role, platformOverride, user, takenTrackIds: string[] }
export async function GET(
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

    const contestUser = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.userId, session.user.id),
      ),
    });

    const platformAdmin = await isPlatformAdmin(session.user.id);

    if (!contestUser && !platformAdmin) {
      return NextResponse.json({ error: "Not enrolled in this contest" }, { status: 404 });
    }

    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { id: true, name: true, email: true, image: true, globalRole: true, department: true, userType: true },
    });

    const takenTrackIds = await takenTrackIdsFor(contest);

    // Platform admins administer every contest — surface them as admin even
    // without a contest_users row (virtual membership, never auto-enrolled).
    if (!contestUser) {
      return NextResponse.json({
        id: "",
        contestId: contest.id,
        userId: session.user.id,
        role: "admin",
        participantRole: null,
        teamId: null,
        platformOverride: true,
        user,
        takenTrackIds,
      });
    }

    return NextResponse.json({
      ...contestUser,
      role: platformAdmin ? "admin" : contestUser.role,
      platformOverride: platformAdmin && contestUser.role !== "admin",
      user,
      takenTrackIds,
    });
  } catch (error) {
    console.error("Error fetching contest user:", error);
    return NextResponse.json({ error: "Failed to fetch contest user" }, { status: 500 });
  }
}

// PUT /api/c/[slug]/users/me - Participant sets their own team role
//
// Body: { participantRole: string | null }
//  - must be one of contest.roleConfig roles when roleConfig is non-empty
//  - respects per-team role caps when the caller is already in a team
//  - null / "" clears the role
// Response: { participantRole }
export async function PUT(
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

    if (contest.status === "completed" || contest.status === "archived") {
      return NextResponse.json({ error: "This contest is closed" }, { status: 409 });
    }

    const contestUser = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.userId, session.user.id),
      ),
    });
    if (!contestUser) {
      return NextResponse.json({ error: "Not enrolled in this contest" }, { status: 404 });
    }
    if (contestUser.role !== "participant") {
      return NextResponse.json(
        { error: "Only participants can choose a team role" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { participantRole?: unknown };
    const raw = body.participantRole;
    if (raw !== null && raw !== undefined && typeof raw !== "string") {
      return NextResponse.json({ error: "participantRole must be a string" }, { status: 400 });
    }
    if (raw === undefined) {
      return NextResponse.json({ error: "participantRole is required" }, { status: 400 });
    }
    const participantRole = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

    if (participantRole) {
      if (participantRole.length > 100) {
        return NextResponse.json({ error: "Role name is too long" }, { status: 400 });
      }
      const roles = roleConfigOf(contest.roleConfig);
      if (roles.length > 0 && !roles.some((r) => r.role === participantRole)) {
        return NextResponse.json(
          { error: `Role must be one of: ${roles.map((r) => r.role).join(", ")}` },
          { status: 400 }
        );
      }

      // Per-team caps (e.g. one Team Lead) when already in a team.
      if (contestUser.teamId && participantRole !== contestUser.participantRole) {
        const slotError = await checkTeamSlot({
          contest,
          teamId: contestUser.teamId,
          userId: session.user.id,
          participantRole,
          mode: "roleChange",
        });
        if (slotError) {
          return NextResponse.json({ error: slotError }, { status: 400 });
        }
      }
    }

    await db
      .update(contestUsers)
      .set({ participantRole })
      .where(eq(contestUsers.id, contestUser.id));

    return NextResponse.json({ participantRole });
  } catch (error) {
    console.error("Error updating contest role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
