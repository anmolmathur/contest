import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, teamInvitations, contestUsers, users } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";
import { dispatchTeamInvite } from "@/lib/notifications/dispatch";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  // Return invitations I sent OR received that are scoped to this contest's teams.
  const rows = await db
    .select({
      id: teamInvitations.id,
      teamId: teamInvitations.teamId,
      teamName: teams.name,
      inviterUserId: teamInvitations.inviterUserId,
      inviteeUserId: teamInvitations.inviteeUserId,
      direction: teamInvitations.direction,
      status: teamInvitations.status,
      message: teamInvitations.message,
      createdAt: teamInvitations.createdAt,
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
    .where(
      and(
        eq(teams.contestId, contest.id),
        or(
          eq(teamInvitations.inviterUserId, session.user.id),
          eq(teamInvitations.inviteeUserId, session.user.id),
        ),
      ),
    );

  return NextResponse.json({ invitations: rows });
}

/** Leader invites a participant (direction='invite') OR participant requests to join (direction='request'). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  const body = await req.json();
  const { teamId, inviteeUserId, direction, message } = body as {
    teamId?: string;
    inviteeUserId?: string;
    direction?: "invite" | "request";
    message?: string;
  };
  if (!teamId || !inviteeUserId || !direction) {
    return NextResponse.json({ error: "teamId, inviteeUserId, direction required" }, { status: 400 });
  }

  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.contestId !== contest.id)
    return NextResponse.json({ error: "Team not in this contest" }, { status: 403 });

  if (direction === "invite" && team.leaderId !== session.user.id) {
    return NextResponse.json({ error: "Only the team leader can invite" }, { status: 403 });
  }
  if (direction === "request" && inviteeUserId !== session.user.id) {
    // Requesters request for themselves. Prevent requesting on someone else's behalf.
    return NextResponse.json({ error: "You can only request to join on your own behalf" }, { status: 403 });
  }

  // Inviter can't invite someone already on a team in this contest.
  const cu = await db.query.contestUsers.findFirst({
    where: and(
      eq(contestUsers.contestId, contest.id),
      eq(contestUsers.userId, inviteeUserId),
    ),
  });
  if (cu?.teamId) {
    return NextResponse.json({ error: "User is already on a team in this contest" }, { status: 400 });
  }

  const [row] = await db
    .insert(teamInvitations)
    .values({
      teamId,
      inviterUserId: session.user.id,
      inviteeUserId,
      direction,
      status: "pending",
      message: message ?? null,
    })
    .returning();

  // Notify the target (invitee if invite, leader if request).
  const inviter = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const targetId = direction === "invite" ? inviteeUserId : team.leaderId ?? team.createdBy;
  if (targetId) {
    dispatchTeamInvite({
      contestId: contest.id,
      inviteeUserId: targetId,
      teamName: team.name,
      inviterName: inviter?.name ?? "Someone",
    }).catch(() => {});
  }

  return NextResponse.json({ invitation: row }, { status: 201 });
}
