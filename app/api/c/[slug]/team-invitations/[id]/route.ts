import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamInvitations, teams, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest } from "@/lib/contest-auth";

/** PATCH: accept or decline. Body: { action: 'accept' | 'decline' | 'cancel' } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, id } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  const { action } = await req.json();
  if (!["accept", "decline", "cancel"].includes(action)) {
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

  // Update invitation row.
  await db
    .update(teamInvitations)
    .set({
      status: action === "cancel" ? "cancelled" : action === "accept" ? "accepted" : "declined",
      updatedAt: new Date(),
    })
    .where(eq(teamInvitations.id, id));

  // If accepted, add the target user to the team via contest_users.
  if (action === "accept") {
    // The "joiner" is whoever wasn't the leader at the point of ask.
    const joinerUserId = inv.direction === "invite" ? inv.inviteeUserId : inv.inviteeUserId;
    const existingCu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, contest.id),
        eq(contestUsers.userId, joinerUserId),
      ),
    });
    if (existingCu) {
      if (existingCu.teamId) {
        return NextResponse.json(
          { error: "User already on a team; invitation was stale" },
          { status: 409 }
        );
      }
      await db.update(contestUsers).set({ teamId: inv.teamId }).where(eq(contestUsers.id, existingCu.id));
    } else {
      await db.insert(contestUsers).values({
        contestId: contest.id,
        userId: joinerUserId,
        role: "participant",
        teamId: inv.teamId,
      });
    }
  }

  return NextResponse.json({ ok: true, status: action });
}
