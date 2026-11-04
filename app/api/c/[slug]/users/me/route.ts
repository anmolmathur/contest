import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, users, teams } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { resolveContest, isPlatformAdmin } from "@/lib/contest-auth";
import { resolveSettings } from "@/lib/contest-config";
import { checkTeamSlot, extraRolesOf, roleConfigOf } from "@/lib/team-capacity";
import { allowsMultipleTeams, isOnTeam, teamIdsOf, teamsOf } from "@/lib/multi-team";

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
// Response: contest_users row fields + { role, platformOverride, user, takenTrackIds: string[],
//   multiTeam: boolean, teams: { id, name, status }[] }  (teams: every team I'm on, active first)
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
        multiTeam: allowsMultipleTeams(contest),
        teams: [],
      });
    }

    return NextResponse.json({
      ...contestUser,
      role: platformAdmin ? "admin" : contestUser.role,
      platformOverride: platformAdmin && contestUser.role !== "admin",
      user,
      takenTrackIds,
      multiTeam: allowsMultipleTeams(contest),
      teams: await teamsOf(contest.id, contestUser.userId, contestUser.teamId),
    });
  } catch (error) {
    console.error("Error fetching contest user:", error);
    return NextResponse.json({ error: "Failed to fetch contest user" }, { status: 500 });
  }
}

// PUT /api/c/[slug]/users/me - Participant sets their own team role(s) / department
//
// Body: { participantRole?: string | null, extraRoles?: string[], department?: string | null }
//  - roles must be from contest.roleConfig when roleConfig is non-empty
//  - extraRoles = further roles the same person plays (Ideathon: one person, many hats)
//  - respects per-team role caps when the caller is already in a team
//  - department must be from settings.departments when that list is set
//  - null / "" clears the primary role
//  - activeTeamId (multi-team contests): switch which of my teams the dashboard shows
// Response: { participantRole, extraRoles, department, activeTeamId? }
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

    const body = (await req.json().catch(() => ({}))) as {
      participantRole?: unknown;
      extraRoles?: unknown;
      department?: unknown;
      activeTeamId?: unknown;
    };

    // ---- Switch active team (multi-team contests only) ----
    if (body.activeTeamId !== undefined) {
      if (typeof body.activeTeamId !== "string" || !body.activeTeamId) {
        return NextResponse.json({ error: "activeTeamId must be a team id" }, { status: 400 });
      }
      if (!allowsMultipleTeams(contest)) {
        return NextResponse.json({ error: "This contest allows only one team per person" }, { status: 400 });
      }
      if (!(await isOnTeam(contestUser, body.activeTeamId))) {
        return NextResponse.json({ error: "You are not on that team" }, { status: 403 });
      }
      await db.update(contestUsers).set({ teamId: body.activeTeamId }).where(eq(contestUsers.id, contestUser.id));
      await db.update(users).set({ teamId: body.activeTeamId }).where(eq(users.id, session.user.id));
      if (body.participantRole === undefined && body.extraRoles === undefined && body.department === undefined) {
        return NextResponse.json({ activeTeamId: body.activeTeamId });
      }
    }

    if (body.participantRole === undefined && body.extraRoles === undefined && body.department === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    // ---- Department (any member) ----
    let department: string | null | undefined;
    if (body.department !== undefined) {
      if (body.department !== null && typeof body.department !== "string") {
        return NextResponse.json({ error: "department must be a string" }, { status: 400 });
      }
      department = typeof body.department === "string" && body.department.trim() ? body.department.trim().slice(0, 255) : null;
      const allowed = resolveSettings(contest.settings).departments;
      if (department && allowed?.length && !allowed.includes(department)) {
        return NextResponse.json({ error: `Department must be one of: ${allowed.join(", ")}` }, { status: 400 });
      }
    }

    // ---- Roles (participants only) ----
    const touchesRoles = body.participantRole !== undefined || body.extraRoles !== undefined;
    if (touchesRoles && contestUser.role !== "participant") {
      return NextResponse.json(
        { error: "Only participants can choose a team role" },
        { status: 403 }
      );
    }

    let participantRole = contestUser.participantRole;
    if (body.participantRole !== undefined) {
      const raw = body.participantRole;
      if (raw !== null && typeof raw !== "string") {
        return NextResponse.json({ error: "participantRole must be a string" }, { status: 400 });
      }
      participantRole = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
    }
    let extraRoles = extraRolesOf(contestUser.extraRoles);
    if (body.extraRoles !== undefined) {
      if (body.extraRoles !== null && !Array.isArray(body.extraRoles)) {
        return NextResponse.json({ error: "extraRoles must be a list" }, { status: 400 });
      }
      extraRoles = extraRolesOf(body.extraRoles);
    }
    extraRoles = extraRoles.filter((r) => r !== participantRole).slice(0, 8);

    if (touchesRoles) {
      const all = [participantRole, ...extraRoles].filter((r): r is string => !!r);
      if (all.some((r) => r.length > 100)) {
        return NextResponse.json({ error: "Role name is too long" }, { status: 400 });
      }
      const roles = roleConfigOf(contest.roleConfig);
      const unknown = roles.length > 0 ? all.find((r) => !roles.some((rc) => rc.role === r)) : undefined;
      if (unknown) {
        return NextResponse.json(
          { error: `Role must be one of: ${roles.map((r) => r.role).join(", ")}` },
          { status: 400 }
        );
      }

      // Per-team caps (e.g. one Team Lead) on every team I'm on. Roles are
      // per person, so in multi-team contests they apply to all my teams.
      const myTeamIds = allowsMultipleTeams(contest)
        ? await teamIdsOf(contest.id, contestUser.userId, contestUser.teamId)
        : contestUser.teamId
          ? [contestUser.teamId]
          : [];
      for (const teamId of all.length > 0 ? myTeamIds : []) {
        const slotError = await checkTeamSlot({
          contest,
          teamId,
          userId: session.user.id,
          participantRole,
          extraRoles,
          mode: "roleChange",
        });
        if (slotError) {
          return NextResponse.json({ error: slotError }, { status: 400 });
        }
      }

      await db
        .update(contestUsers)
        .set({ participantRole, extraRoles })
        .where(eq(contestUsers.id, contestUser.id));
    }

    if (department !== undefined) {
      await db.update(users).set({ department, updatedAt: new Date() }).where(eq(users.id, session.user.id));
    }

    return NextResponse.json({ participantRole, extraRoles, department });
  } catch (error) {
    console.error("Error updating contest role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
