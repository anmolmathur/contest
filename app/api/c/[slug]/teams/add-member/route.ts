import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";

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

    if (!userId || !teamId) {
      return NextResponse.json(
        { error: "Missing required fields: userId and teamId" },
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

    // Check if user to be added is assigned to this contest
    const targetContestUser = await getContestUser(userId, contest.id);
    if (!targetContestUser) {
      return NextResponse.json(
        { error: "User is not assigned to this contest" },
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

    // Get current team members (via contest_users)
    const teamMembers = await db.query.contestUsers.findMany({
      where: and(
        eq(contestUsers.teamId, teamId),
        eq(contestUsers.contestId, contest.id),
      ),
      with: {
        user: {
          columns: {
            id: true,
            role: true,
          },
        },
      },
    });

    // Check team size limit from contest config
    if (teamMembers.length >= contest.maxTeamMembers) {
      return NextResponse.json(
        { error: `Team is full (maximum ${contest.maxTeamMembers} members)` },
        { status: 400 }
      );
    }

    // Validate role limits from contest.roleConfig
    const roleConfig = contest.roleConfig as Array<{ role: string; maxPerTeam: number }> | null;
    if (roleConfig && targetContestUser.participantRole) {
      const roleCounts: Record<string, number> = {};
      for (const member of teamMembers) {
        const cu = await getContestUser(member.userId, contest.id);
        if (cu?.participantRole) {
          roleCounts[cu.participantRole] = (roleCounts[cu.participantRole] || 0) + 1;
        }
      }

      const newUserRole = targetContestUser.participantRole;
      const roleLimit = roleConfig.find((rc) => rc.role === newUserRole);
      if (roleLimit) {
        const currentCount = roleCounts[newUserRole] || 0;
        if (currentCount >= roleLimit.maxPerTeam) {
          return NextResponse.json(
            {
              error: `Maximum ${roleLimit.maxPerTeam} ${newUserRole}(s) allowed per team`,
            },
            { status: 400 }
          );
        }
      }
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

    return NextResponse.json(
      { message: "Member added successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
