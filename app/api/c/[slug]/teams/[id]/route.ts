import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, submissions, contestUsers, tracks } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { resolveContest, canAdminContest } from "@/lib/contest-auth";
import { resolveSettings } from "@/lib/contest-config";
import { contestTerm } from "@/lib/api-input";
import { allowsMultipleTeams, onTeam, reassignActiveTeam } from "@/lib/multi-team";

// GET - Get team details with members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, id), eq(teams.contestId, contest.id)),
      with: {
        trackRef: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get team members via contest_users for contest-scoped membership
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        department: users.department,
        participantRole: contestUsers.participantRole,
        extraRoles: contestUsers.extraRoles,
        contestRole: contestUsers.role,
        memberIdentifier: contestUsers.memberIdentifier,
      })
      .from(contestUsers)
      .innerJoin(users, eq(contestUsers.userId, users.id))
      .where(
        and(
          onTeam(id),
          eq(contestUsers.contestId, contest.id),
        )
      );

    return NextResponse.json({ team, members }, { status: 200 });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update team name/trackId (creator or admin only, before submissions)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, trackId } = body;

    // Get the team (scoped to this contest)
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, id), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is creator or admin
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only team creator or admin can update the team" },
        { status: 403 }
      );
    }

    // Check if team has any submissions (only allow edits before submission for non-admins)
    if (!isAdmin) {
      const teamSubmissions = await db.query.submissions.findMany({
        where: eq(submissions.teamId, id),
      });

      if (teamSubmissions.length > 0) {
        return NextResponse.json(
          { error: "Cannot update team after submissions have been made" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined && name.trim() !== "") {
      updateData.name = name.trim();
    }

    if (trackId !== undefined && trackId !== (team.trackId ?? null)) {
      const trackWord = contestTerm(contest, "track").toLowerCase();
      const contestTracks = await db.query.tracks.findMany({
        where: eq(tracks.contestId, contest.id),
        columns: { id: true, name: true },
      });

      if (!trackId) {
        // Clearing the track is only allowed when the contest has no tracks.
        if (contestTracks.length > 0) {
          return NextResponse.json(
            { error: `Please select a ${trackWord}` },
            { status: 400 }
          );
        }
        updateData.trackId = null;
      } else {
        // Validate the track belongs to this contest
        const track = contestTracks.find((t) => t.id === trackId);
        if (!track) {
          return NextResponse.json(
            { error: `Invalid ${trackWord} for this contest` },
            { status: 400 }
          );
        }

        // One team per track/category when the contest says so.
        if (resolveSettings(contest.settings).exclusiveTracks) {
          const taken = await db.query.teams.findFirst({
            where: and(eq(teams.contestId, contest.id), eq(teams.trackId, track.id), ne(teams.id, team.id)),
            columns: { id: true },
          });
          if (taken) {
            return NextResponse.json(
              {
                error: `The ${trackWord} "${track.name}" has already been taken by another ${contestTerm(contest, "team").toLowerCase()}. Please choose a different ${trackWord}.`,
                code: "TRACK_TAKEN",
              },
              { status: 409 }
            );
          }
        }
        updateData.trackId = track.id;
      }
    }

    const [updatedTeam] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json({
      message: "Team updated successfully",
      team: updatedTeam,
    });
  } catch (error: unknown) {
    console.error("Update team error:", error);
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

// DELETE - Delete team (creator or admin only, before submissions unless admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

    const contest = await resolveContest(slug);
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Get the team (scoped to this contest)
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, id), eq(teams.contestId, contest.id)),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check if user is creator or admin
    const isCreator = team.createdBy === session.user.id;
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only team creator or admin can delete the team" },
        { status: 403 }
      );
    }

    // Check if team has any submissions (only allow deletion before submission for non-admins)
    if (!isAdmin) {
      const teamSubmissions = await db.query.submissions.findMany({
        where: eq(submissions.teamId, id),
      });

      if (teamSubmissions.length > 0) {
        return NextResponse.json(
          { error: "Cannot delete team after submissions have been made" },
          { status: 400 }
        );
      }
    }

    // Multi-team (Ideathon): members whose active team this was move to
    // another team they're on; team_members rows go with the team (cascade).
    if (allowsMultipleTeams(contest)) {
      await db.transaction(async (tx) => {
        await reassignActiveTeam(tx, contest.id, id);
        await tx.delete(teams).where(eq(teams.id, id));
      });
      return NextResponse.json({ message: "Team deleted successfully" });
    }

    // Clear team association from contest_users records
    await db
      .update(contestUsers)
      .set({ teamId: null })
      .where(
        and(
          eq(contestUsers.teamId, id),
          eq(contestUsers.contestId, contest.id),
        )
      );

    // Remove team association from users table (backward compat)
    await db
      .update(users)
      .set({ teamId: null })
      .where(eq(users.teamId, id));

    // Delete the team (cascade will handle submissions if any)
    await db.delete(teams).where(eq(teams.id, id));

    return NextResponse.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Delete team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
