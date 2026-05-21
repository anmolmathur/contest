import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, contestUsers } from "@/lib/db/schema";
import { eq, count, and } from "drizzle-orm";
import { legacyAuthz, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";
import { getContestById } from "@/lib/contest-auth";

export async function POST(req: NextRequest) {
  try {
    const az = await legacyAuthz();
    if (!az.canRead) throw new LegacyAuthError(403, "Join the contest first");
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen");

    const body = await req.json();
    const { name, track } = body;
    if (!name || !track) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Team-limit from contest config (not a hardcoded constant)
    const contest = await getContestById(az.defaultContestId);
    const maxTeams = contest?.maxTeams ?? 50;

    const [teamCountResult] = await db
      .select({ count: count() })
      .from(teams)
      .where(eq(teams.contestId, az.defaultContestId));
    if (teamCountResult.count >= maxTeams) {
      return NextResponse.json(
        { error: `Maximum team limit (${maxTeams}) reached` },
        { status: 400 }
      );
    }

    // Check the caller isn't already on a team in this contest
    const cu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.userId, az.userId),
      ),
    });
    if (cu?.teamId) {
      return NextResponse.json(
        { error: "You are already in a team for this contest" },
        { status: 400 }
      );
    }

    const [newTeam] = await db
      .insert(teams)
      .values({
        name,
        track,
        contestId: az.defaultContestId,
        createdBy: az.userId,
        leaderId: az.userId,
      })
      .returning();

    // Upsert the creator into contest_users with the new team
    if (cu) {
      await db
        .update(contestUsers)
        .set({ teamId: newTeam.id })
        .where(eq(contestUsers.id, cu.id));
    } else {
      await db.insert(contestUsers).values({
        contestId: az.defaultContestId,
        userId: az.userId,
        role: "participant",
        teamId: newTeam.id,
      });
    }

    return NextResponse.json(
      { message: "Team created successfully", team: newTeam },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "23505") {
      return NextResponse.json({ error: "Team name already exists" }, { status: 400 });
    }
    return errorResponse(error);
  }
}
