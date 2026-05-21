/**
 * Team mentor management.
 *
 * Mentors are optional team advisors. They are contest_users rows with
 * role='mentor' whose `teamId` points at the team they advise. They do NOT
 * count against the team's maxTeamMembers limit and do NOT participate in
 * submissions, judging, or scoring.
 *
 *   GET    /api/c/[slug]/teams/[id]/mentor    — list current mentors
 *   POST   /api/c/[slug]/teams/[id]/mentor    — attach a mentor
 *   DELETE /api/c/[slug]/teams/[id]/mentor    — detach a mentor (body: { userId })
 *
 * Authorization: team leader OR contest admin can manage mentors.
 * The mentor-user itself must be a platform user (any existing account);
 * we'll create a contest_users row if one doesn't exist yet, or update
 * the role to 'mentor' if they already have one (with admin consent).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";

async function resolveGuardedTeam(
  slug: string,
  teamId: string,
  userId: string,
) {
  const contest = await resolveContest(slug);
  if (!contest) return { error: NextResponse.json({ error: "Contest not found" }, { status: 404 }) };

  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.contestId, contest.id)),
  });
  if (!team) return { error: NextResponse.json({ error: "Team not found" }, { status: 404 }) };

  const isAdmin = await canAdminContest(userId, contest.id);
  const isLeader = team.leaderId === userId || team.createdBy === userId;
  if (!isAdmin && !isLeader) {
    return { error: NextResponse.json({ error: "Only the team leader or a contest admin can manage mentors" }, { status: 403 }) };
  }

  return { contest, team, isAdmin, isLeader };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const guarded = await resolveGuardedTeam(slug, id, session.user.id);
  if ("error" in guarded) return guarded.error;

  const rows = await db.query.contestUsers.findMany({
    where: and(
      eq(contestUsers.contestId, guarded.contest.id),
      eq(contestUsers.teamId, id),
      eq(contestUsers.role, "mentor"),
    ),
    with: { user: { columns: { id: true, name: true, email: true, department: true } } },
  });

  return NextResponse.json({
    mentors: rows
      .filter((r) => r.user)
      .map((r) => ({
        userId: r.user!.id,
        name: r.user!.name,
        email: r.user!.email,
        department: r.user!.department,
        participantRole: r.participantRole,
      })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const guarded = await resolveGuardedTeam(slug, id, session.user.id);
  if ("error" in guarded) return guarded.error;

  const body = (await req.json()) as { email?: string; userId?: string; title?: string };
  if (!body.email && !body.userId) {
    return NextResponse.json({ error: "email or userId required" }, { status: 400 });
  }

  // Look the user up — we accept either an ID (trusted caller) or email (UX-friendly).
  const user = body.userId
    ? await db.query.users.findFirst({ where: eq(users.id, body.userId) })
    : await db.query.users.findFirst({ where: eq(users.email, body.email!) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Does this user already have a contest_users row for this contest?
  const existing = await getContestUser(user.id, guarded.contest.id);

  if (existing) {
    // Block promoting an active participant/judge/admin to mentor — that
    // would be ambiguous. Only allow an existing mentor row to be re-linked
    // to a different team, or a clean (team-less) row to become a mentor.
    if (existing.role !== "mentor") {
      if (existing.role === "participant" && existing.teamId) {
        return NextResponse.json(
          { error: `${user.email} is already on a team as a participant. Remove them from that team first.` },
          { status: 409 }
        );
      }
      if (!guarded.isAdmin) {
        return NextResponse.json(
          { error: `${user.email} already has role '${existing.role}' in this contest. Contest admin must change it.` },
          { status: 409 }
        );
      }
    }

    await db
      .update(contestUsers)
      .set({
        role: "mentor",
        teamId: id,
        participantRole: body.title ?? existing.participantRole ?? "Mentor",
      })
      .where(eq(contestUsers.id, existing.id));
  } else {
    await db.insert(contestUsers).values({
      contestId: guarded.contest.id,
      userId: user.id,
      role: "mentor",
      teamId: id,
      participantRole: body.title ?? "Mentor",
    });
  }

  return NextResponse.json({
    ok: true,
    mentor: {
      userId: user.id,
      name: user.name,
      email: user.email,
      title: body.title ?? "Mentor",
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, id } = await params;
  const guarded = await resolveGuardedTeam(slug, id, session.user.id);
  if ("error" in guarded) return guarded.error;

  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const row = await db.query.contestUsers.findFirst({
    where: and(
      eq(contestUsers.contestId, guarded.contest.id),
      eq(contestUsers.userId, userId),
      eq(contestUsers.teamId, id),
      eq(contestUsers.role, "mentor"),
    ),
  });
  if (!row) return NextResponse.json({ error: "Mentor not found on this team" }, { status: 404 });

  // Unlink — keep the contest_users row (so the mentor's history is preserved
  // if they get re-attached later), but blank the teamId. An admin can also
  // delete the row outright via the existing /users/[id] endpoint.
  await db.update(contestUsers).set({ teamId: null }).where(eq(contestUsers.id, row.id));

  return NextResponse.json({ ok: true });
}
