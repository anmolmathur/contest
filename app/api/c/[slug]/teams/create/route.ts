import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, users, contestUsers, tracks } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { resolveContest, canAdminContest, getContestUser } from "@/lib/contest-auth";
import { resolveSettings } from "@/lib/contest-config";
import { contestTerm } from "@/lib/api-input";

/**
 * POST /api/c/[slug]/teams/create
 * Body: { name: string, trackId?: string }
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

    // Check registration deadline
    if (contest.registrationDeadline && new Date() > new Date(contest.registrationDeadline)) {
      return NextResponse.json(
        { error: "Registration deadline has passed. Team creation is no longer allowed." },
        { status: 403 }
      );
    }

    // Check user is a participant in this contest (or admin)
    const contestUser = await getContestUser(session.user.id, contest.id);
    const isAdmin = await canAdminContest(session.user.id, contest.id, session.user.email ?? undefined);

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

    // Check if user already has a team in this contest (via contest_users.teamId)
    if (contestUser?.teamId) {
      return NextResponse.json(
        { error: "You are already in a team for this contest" },
        { status: 400 }
      );
    }

    // Create team (creator is also the initial leader)
    const [newTeam] = await db
      .insert(teams)
      .values({
        name,
        contestId: contest.id,
        trackId: track?.id ?? null,
        createdBy: session.user.id,
        leaderId: session.user.id,
      })
      .returning();

    // Update the contest_users record for this user with the teamId
    if (contestUser) {
      await db
        .update(contestUsers)
        .set({ teamId: newTeam.id })
        .where(eq(contestUsers.id, contestUser.id));
    }

    // Also update users.teamId for backward compat
    await db
      .update(users)
      .set({ teamId: newTeam.id })
      .where(eq(users.id, session.user.id));

    return NextResponse.json(
      { message: "Team created successfully", team: newTeam },
      { status: 201 }
    );
  } catch (error: unknown) {
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
