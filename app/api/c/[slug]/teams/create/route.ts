import { NextRequest, NextResponse } from "next/server";
import { dispatchMembersAdded, dispatchTeamJoined } from "@/lib/notifications/dispatch";
import { addMember, MemberConflictError, memberError, parseMembers, type MemberInput } from "@/lib/team-members";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, contestUsers, tracks } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";
import { resolveSettings } from "@/lib/contest-config";
import { contestTerm } from "@/lib/api-input";
import { allowsMultipleTeams, recordMembership } from "@/lib/multi-team";

/**
 * POST /api/c/[slug]/teams/create
 * Body: { name: string, trackId?: string, members?: { email: string, name?: string }[],
 *         leader?: { email: string, name?: string } }
 *
 * `leader` (contest/platform admins only) creates the team on someone's
 * behalf: that person becomes creator + leader and the admin is not added.
 * Admins may also create teams after the registration deadline.
 *
 * `members` are the creator's teammates: known emails are reused, new ones get
 * an account (`name` required) and a set-password email. Everyone is emailed.
 *
 * `trackId` is required when the contest has tracks/categories and optional
 * when it has none. With `settings.exclusiveTracks` each track can be picked
 * by only one team.
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

    // Check user is a participant in this contest (or admin)
    const contestUser = await getContestUser(session.user.id, contest.id);
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

    // Check registration deadline (organisers can still set teams up)
    if (!isAdmin && contest.registrationDeadline && new Date() > new Date(contest.registrationDeadline)) {
      return NextResponse.json(
        { error: "Registration deadline has passed. Team creation is no longer allowed." },
        { status: 403 }
      );
    }

    if (!contestUser && !isAdmin) {
      return NextResponse.json(
        { error: "You are not assigned to this contest" },
        { status: 403 }
      );
    }

    if (contestUser && contestUser.role !== "participant" && !isAdmin) {
      return NextResponse.json(
        { error: "Only participants can create teams" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const trackId = typeof body?.trackId === "string" && body.trackId ? body.trackId : null;
    const trackWord = contestTerm(contest, "track");

    if (!name) {
      return NextResponse.json(
        { error: `Missing required field: ${contestTerm(contest, "team").toLowerCase()} name` },
        { status: 400 }
      );
    }

    // Tracks are optional only when the contest has none configured.
    const contestTracks = await db.query.tracks.findMany({
      where: eq(tracks.contestId, contest.id),
      columns: { id: true, name: true },
    });

    let track: { id: string; name: string } | undefined;
    if (contestTracks.length > 0) {
      if (!trackId) {
        return NextResponse.json(
          { error: `Please select a ${trackWord.toLowerCase()}` },
          { status: 400 }
        );
      }
      track = contestTracks.find((t) => t.id === trackId);
      if (!track) {
        return NextResponse.json(
          { error: `Invalid ${trackWord.toLowerCase()} for this contest` },
          { status: 400 }
        );
      }
    } else if (trackId) {
      return NextResponse.json(
        { error: `This contest has no ${trackWord.toLowerCase()} to choose from` },
        { status: 400 }
      );
    }

    // One team per track/category when the contest says so.
    if (track && resolveSettings(contest.settings).exclusiveTracks) {
      const taken = await db.query.teams.findFirst({
        where: and(eq(teams.contestId, contest.id), eq(teams.trackId, track.id)),
        columns: { id: true },
      });
      if (taken) {
        return NextResponse.json(
          {
            error: `The ${trackWord.toLowerCase()} "${track.name}" has already been taken by another ${contestTerm(contest, "team").toLowerCase()}. Please choose a different ${trackWord.toLowerCase()}.`,
            code: "TRACK_TAKEN",
          },
          { status: 409 }
        );
      }
    }

    // Check if team count limit has been reached
    const [teamCountResult] = await db
      .select({ count: count() })
      .from(teams)
      .where(eq(teams.contestId, contest.id));

    if (teamCountResult.count >= contest.maxTeams) {
      return NextResponse.json(
        { error: `Maximum team limit (${contest.maxTeams}) reached for this contest` },
        { status: 400 }
      );
    }

    // One team per person, except where the contest type allows several
    // (Ideathon): then the new team simply becomes their active team.
    const multiTeam = allowsMultipleTeams(contest);

    // Admin creating the team for someone else: they lead it, admin stays out.
    let leader: MemberInput | null = null;
    if (body?.leader !== undefined && body?.leader !== null) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Only organisers can create a team for someone else" }, { status: 403 });
      }
      const parsed = parseMembers([body.leader]);
      if (parsed.error) {
        return NextResponse.json({ error: `Leader: ${parsed.error}` }, { status: 400 });
      }
      leader = parsed.members[0];
    }

    if (!leader && contestUser?.teamId && !multiTeam) {
      return NextResponse.json(
        { error: "You are already in a team for this contest" },
        { status: 400 }
      );
    }

    // Teammates named by email (the creator takes one of the team's seats).
    const { members, error: membersError } = parseMembers(body?.members);
    if (membersError) {
      return NextResponse.json({ error: membersError }, { status: 400 });
    }
    const creatorEmail = (leader?.email ?? session.user.email)?.trim().toLowerCase();
    if (members.some((m) => m.email === creatorEmail)) {
      return NextResponse.json(
        {
          error: leader
            ? `${leader.email} is already the leader. List only the other teammates.`
            : "You are already on this team. Add only your teammates.",
        },
        { status: 400 }
      );
    }
    if (members.length + 1 > contest.maxTeamMembers) {
      return NextResponse.json(
        {
          error: leader
            ? `A team can have at most ${contest.maxTeamMembers} members including the leader`
            : `A team can have at most ${contest.maxTeamMembers} members including you`,
        },
        { status: 400 }
      );
    }
    const teamWord = contestTerm(contest, "team");
    for (const member of leader ? [leader, ...members] : members) {
      const memberProblem = await memberError(contest.id, member, teamWord, { multiTeam });
      if (memberProblem) {
        return NextResponse.json({ error: memberProblem }, { status: 400 });
      }
    }

    // Team and members land together, so one bad teammate leaves nothing behind.
    const { newTeam, added } = await db.transaction(async (tx) => {
      // Create team (creator is also the initial leader)
      const [newTeam] = await tx
        .insert(teams)
        .values({
          name,
          contestId: contest.id,
          trackId: track?.id ?? null,
          createdBy: session.user.id,
          leaderId: session.user.id,
        })
        .returning();

      const added = [];

      if (leader) {
        // On behalf of `leader`: enrol them, then hand them the team.
        const result = await addMember(tx, { contestId: contest.id, teamId: newTeam.id, member: leader, multiTeam });
        added.push({ email: leader.email, ...result });
        const [handed] = await tx
          .update(teams)
          .set({ createdBy: result.userId, leaderId: result.userId })
          .where(eq(teams.id, newTeam.id))
          .returning();
        for (const member of members) {
          const r = await addMember(tx, { contestId: contest.id, teamId: newTeam.id, member, multiTeam });
          added.push({ email: member.email, ...r });
        }
        return { newTeam: handed, added };
      }

      // Put the creator on the team via contest_users. An admin with no
      // contest_users row (e.g. a platform admin) gets one here: without it
      // the admin panel listed them as leader while their own dashboard said
      // "You are not part of any team yet".
      if (contestUser) {
        await tx
          .update(contestUsers)
          .set({ teamId: newTeam.id })
          .where(eq(contestUsers.id, contestUser.id));
      } else {
        await tx
          .insert(contestUsers)
          .values({ contestId: contest.id, userId: session.user.id, role: "participant", teamId: newTeam.id })
          .onConflictDoUpdate({
            target: [contestUsers.contestId, contestUsers.userId],
            set: { teamId: newTeam.id },
          });
      }
      if (multiTeam) {
        // Keep the previous active team on record before switching away from it.
        if (contestUser?.teamId) await recordMembership(tx, contest, contestUser.teamId, session.user.id);
        await recordMembership(tx, contest, newTeam.id, session.user.id);
      }

      // Also update users.teamId for backward compat
      await tx
        .update(users)
        .set({ teamId: newTeam.id })
        .where(eq(users.id, session.user.id));

      for (const member of members) {
        const result = await addMember(tx, { contestId: contest.id, teamId: newTeam.id, member, multiTeam });
        added.push({ email: member.email, ...result });
      }
      return { newTeam, added };
    });

    if (!leader) {
      dispatchTeamJoined({
        contestId: contest.id,
        userId: session.user.id,
        teamId: newTeam.id,
        teamName: newTeam.name,
        created: true,
      }).catch(() => {});
    }

    dispatchMembersAdded({
      contest,
      teamId: newTeam.id,
      teamName: newTeam.name,
      addedByName: session.user.name,
      added,
    }).catch((e) => console.error("Team member notification error:", e));

    return NextResponse.json(
      { message: "Team created successfully", team: newTeam },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof MemberConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Team creation error:", error);
    if ((error as { code?: string } | null)?.code === "23505") {
      return NextResponse.json(
        { error: "Team name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
