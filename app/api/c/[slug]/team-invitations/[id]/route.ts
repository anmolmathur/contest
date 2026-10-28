import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamInvitations, teams, contestUsers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";
import { dispatchTeamJoined } from "@/lib/notifications/dispatch";
import { checkTeamSlot, extraRolesOf } from "@/lib/team-capacity";

/**
 * PATCH: accept / decline / cancel.  Body: { action: 'accept' | 'decline' | 'cancel' }
 *
 * Accepting enforces the same rules as teams/add-member: the joiner must not
 * already be on a team, mentors can't join as participants, and the team's
 * size (participants only) and per-role caps (contest.roleConfig) apply.
 * All checks run BEFORE the invitation is marked accepted, so a rejected
 * accept leaves the invitation pending. After the registration deadline,
 * only contest admins can accept; decline and cancel stay open.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (!action || !["accept", "decline", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const inv = await db.query.teamInvitations.findFirst({
    where: eq(teamInvitations.id, id),
  });
  if (!inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (inv.status !== "pending") {
    return NextResponse.json({ error: `Invitation already ${inv.status}` }, { status: 409 });
  }

  const team = await db.query.teams.findFirst({ where: eq(teams.id, inv.teamId) });
  if (!team || team.contestId !== contest.id) {
    return NextResponse.json({ error: "Invitation does not match contest" }, { status: 403 });
  }

  // Permission model:
  //   invite (leader→user):   invitee accepts/declines, inviter can cancel
  //   request (user→leader):  leader accepts/declines, inviter can cancel
  const isInvitee = session.user.id === inv.inviteeUserId;
  const isInviter = session.user.id === inv.inviterUserId;
  const isTeamLeader = team.leaderId === session.user.id;

  if (action === "cancel" && !isInviter) {
    return NextResponse.json({ error: "Only the inviter can cancel" }, { status: 403 });
  }
  if (action !== "cancel") {
    const canDecide =
      (inv.direction === "invite" && isInvitee) ||
      (inv.direction === "request" && isTeamLeader);
    if (!canDecide) return NextResponse.json({ error: "Not authorized to decide" }, { status: 403 });
  }

  if (action === "accept") {
    if (
      contest.registrationDeadline && new Date() > new Date(contest.registrationDeadline) &&
      !(await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined))
    ) {
      return NextResponse.json(
        { error: "Registration deadline has passed. Teams can no longer take new members." },
        { status: 403 }
      );
    }

    // The joiner is always the invitee (invite: the invited user; request: the requester).
    const joinerUserId = inv.inviteeUserId;
    const existingCu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.userId, joinerUserId),
      ),
    });

    if (existingCu?.teamId) {
      return NextResponse.json(
        { error: "User already on a team; invitation was stale" },
        { status: 409 }
      );
    }
    if (existingCu && existingCu.role === "mentor") {
      return NextResponse.json(
        { error: "Mentors are attached to teams by the organisers, not via invitations" },
        { status: 400 }
      );
    }

    // Same size + role-cap rules as teams/add-member.
    const slotError = await checkTeamSlot({
      contest,
      teamId: inv.teamId,
      userId: joinerUserId,
      participantRole: existingCu?.participantRole ?? null,
      extraRoles: extraRolesOf(existingCu?.extraRoles),
      mode: "join",
    });
    if (slotError) {
      return NextResponse.json({ error: slotError }, { status: 400 });
    }

    if (existingCu) {
      await db.update(contestUsers).set({ teamId: inv.teamId }).where(eq(contestUsers.id, existingCu.id));
    } else {
      await db.insert(contestUsers).values({
        contestId: contest.id,
        userId: joinerUserId,
        role: "participant",
        teamId: inv.teamId,
      });
    }

    // Keep users.teamId in sync for backward compat (same as add-member).
    await db.update(users).set({ teamId: inv.teamId }).where(eq(users.id, joinerUserId));

    dispatchTeamJoined({
      contestId: contest.id,
      userId: joinerUserId,
      teamName: team.name,
      created: false,
    }).catch(() => {});
  }

  await db
    .update(teamInvitations)
    .set({
      status: action === "cancel" ? "cancelled" : action === "accept" ? "accepted" : "declined",
      updatedAt: new Date(),
    })
    .where(eq(teamInvitations.id, id));

  return NextResponse.json({ ok: true, status: action });
}
