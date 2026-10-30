import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";
import { checkTeamSlot, extraRolesOf } from "@/lib/team-capacity";
import { dispatchMembersAdded, dispatchTeamJoined } from "@/lib/notifications/dispatch";
import { addMember, MemberConflictError, memberError, parseMembers } from "@/lib/team-members";
import { contestTerm } from "@/lib/api-input";

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

    const body = await req.json();
    const { userId, teamId } = body;
    const byEmail = body.email !== undefined;

    if ((!userId && !byEmail) || !teamId) {
      return NextResponse.json(
        { error: "Missing required fields: teamId and userId or email" },
        { status: 400 }
      );
    }

    // Get the team (scoped to this contest)
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, teamId), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Verify the requesting user is the team creator or admin
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only team creator or admin can add members" },
        { status: 403 }
      );
    }

    // Team rosters lock at the registration deadline; organisers can still edit.
    if (!isAdmin && contest.registrationDeadline && new Date() > new Date(contest.registrationDeadline)) {
      return NextResponse.json(
        { error: "Registration deadline has passed. Team members can no longer be added." },
        { status: 403 }
      );
    }

    if (byEmail) {
      const { members, error: inputError } = parseMembers([{ email: body.email, name: body.name }]);
      if (inputError) {
        return NextResponse.json({ error: inputError }, { status: 400 });
      }
      const member = members[0];
      const problem = await memberError(contest.id, member, contestTerm(contest, "team"));
      if (problem) {
        return NextResponse.json({ error: problem }, { status: 400 });
      }
      const slotError = await checkTeamSlot({
        contest,
        teamId,
        userId: "",
        participantRole: null,
        mode: "join",
      });
      if (slotError) {
        return NextResponse.json({ error: slotError }, { status: 400 });
      }

      const result = await db.transaction((tx) =>
        addMember(tx, { contestId: contest.id, teamId, member })
      );
      dispatchMembersAdded({
        contest,
        teamName: team.name,
        addedByName: session.user.name,
        added: [{ email: member.email, ...result }],
      }).catch((e) => console.error("Team member notification error:", e));

      return NextResponse.json({ message: "Member added successfully" }, { status: 200 });
    }

    // Check if user to be added is assigned to this contest
    const targetContestUser = await getContestUser(userId, contest.id);
    if (!targetContestUser) {
      return NextResponse.json(
        { error: "User is not assigned to this contest" },
        { status: 400 }
      );
    }

    // Block adding a mentor via this endpoint — mentors go through
    // /api/c/[slug]/teams/[id]/mentor so they're kept distinct from
    // participants throughout the team lifecycle.
    if (targetContestUser.role === "mentor") {
      return NextResponse.json(
        { error: "Use the mentor endpoint to attach a mentor to a team" },
        { status: 400 }
      );
    }

    // Check if user already has a team in this contest
    if (targetContestUser.teamId) {
      return NextResponse.json(
        { error: "User is already in a team for this contest" },
        { status: 400 }
      );
    }

    // Team size (participants only — mentors don't count against
    // maxTeamMembers) and per-role caps from contest.roleConfig.
    const slotError = await checkTeamSlot({
      contest,
      teamId,
      userId,
      participantRole: targetContestUser.participantRole,
      extraRoles: extraRolesOf(targetContestUser.extraRoles),
      mode: "join",
    });
    if (slotError) {
      return NextResponse.json({ error: slotError }, { status: 400 });
    }

    // Update contest_users record with team assignment
    await db
      .update(contestUsers)
      .set({ teamId })
      .where(eq(contestUsers.id, targetContestUser.id));

    // Also update users.teamId for backward compat
    await db
      .update(users)
      .set({ teamId })
      .where(eq(users.id, userId));

    dispatchTeamJoined({ contestId: contest.id, userId, teamName: team.name, created: false }).catch(() => {});

    return NextResponse.json(
      { message: "Member added successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof MemberConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
