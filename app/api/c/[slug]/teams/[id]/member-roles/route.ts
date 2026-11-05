import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, teams } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";
import { checkTeamSlot, roleConfigOf } from "@/lib/team-capacity";
import { allowsMultipleTeams, isOnTeam, teamIdsOf } from "@/lib/multi-team";

/**
 * PUT /api/c/[slug]/teams/[id]/member-roles — assign a teammate's team roles.
 * Body: { userId: string, roles: string[] }  (first = primary role, rest = extra roles)
 *
 * Allowed for organisers (contest/platform admins) and for the team's creator
 * or leader. Roles must come from contest.roleConfig and respect its
 * per-team caps. Roles belong to the person, so in multi-team contests the
 * caps are checked on every crew they're on.
 * Response: { userId, participantRole, extraRoles }
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug, id } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (contest.status === "completed" || contest.status === "archived") {
      return NextResponse.json({ error: "This contest is closed" }, { status: 409 });
    }

    const team = await db.query.teams.findFirst({ where: and(eq(teams.id, id), eq(teams.contestId, contest.id)) });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);
    const isLead = team.createdBy === session.user.id || team.leaderId === session.user.id;
    if (!isAdmin && !(isLead && (await isOnTeam(await getContestUser(session.user.id, contest.id), id)))) {
      return NextResponse.json({ error: "Only the team leader, creator or an organiser can assign roles" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { userId?: unknown; roles?: unknown };
    if (typeof body.userId !== "string" || !Array.isArray(body.roles)) {
      return NextResponse.json({ error: "userId and roles are required" }, { status: 400 });
    }
    const roles = [
      ...new Set(body.roles.filter((r): r is string => typeof r === "string" && r.trim() !== "").map((r) => r.trim())),
    ].slice(0, 9);

    const caps = roleConfigOf(contest.roleConfig);
    if (caps.length === 0) {
      return NextResponse.json({ error: "This contest has no team roles to assign" }, { status: 400 });
    }
    const unknown = roles.find((r) => !caps.some((c) => c.role === r));
    if (unknown) {
      return NextResponse.json({ error: `Role must be one of: ${caps.map((c) => c.role).join(", ")}` }, { status: 400 });
    }

    const target = await getContestUser(body.userId, contest.id);
    if (!target || !(await isOnTeam(target, id))) {
      return NextResponse.json({ error: "That person is not on this team" }, { status: 400 });
    }
    if (target.role !== "participant") {
      return NextResponse.json({ error: "Only participants hold team roles" }, { status: 400 });
    }

    const participantRole = roles[0] ?? null;
    const extraRoles = roles.slice(1);

    const teamIds = allowsMultipleTeams(contest) ? await teamIdsOf(contest.id, target.userId, target.teamId) : [id];
    for (const teamId of roles.length > 0 ? (teamIds.includes(id) ? teamIds : [id, ...teamIds]) : []) {
      const slotError = await checkTeamSlot({
        contest,
        teamId,
        userId: target.userId,
        participantRole,
        extraRoles,
        mode: "roleChange",
      });
      if (slotError) return NextResponse.json({ error: slotError }, { status: 400 });
    }

    await db.update(contestUsers).set({ participantRole, extraRoles }).where(eq(contestUsers.id, target.id));
    return NextResponse.json({ userId: target.userId, participantRole, extraRoles });
  } catch (error) {
    console.error("Assign member roles error:", error);
    return NextResponse.json({ error: "Failed to assign roles" }, { status: 500 });
  }
}
