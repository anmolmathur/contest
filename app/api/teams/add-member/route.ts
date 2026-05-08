import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, teams, contestUsers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { legacyAuthz, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";
import { getContestById } from "@/lib/contest-auth";

export async function POST(req: NextRequest) {
  try {
    const az = await legacyAuthz();
    if (!az.canRead) throw new LegacyAuthError(403, "Join the contest first");
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen");

    const body = await req.json();
    const { userId, teamId } = body;
    if (!userId || !teamId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.contestId !== az.defaultContestId) {
      throw new LegacyAuthError(403, "Team is not in your contest");
    }
    if (team.createdBy !== az.userId && !az.isJudge) {
      return NextResponse.json(
        { error: "Only team creator or admin can add members" },
        { status: 403 }
      );
    }

    const userToAdd = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!userToAdd) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user to add is already on a team in this contest
    const existingCu = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.userId, userId),
      ),
    });
    if (existingCu?.teamId) {
      return NextResponse.json(
        { error: "User is already in a team for this contest" },
        { status: 400 }
      );
    }

    // Team-size limit from contest config
    const contest = await getContestById(az.defaultContestId);
    const maxTeamMembers = contest?.maxTeamMembers ?? 7;

    const currentMembers = await db.query.contestUsers.findMany({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.teamId, teamId),
      ),
    });
    // Mentors don't count against maxTeamMembers.
    const participantMembers = currentMembers.filter((m) => m.role !== "mentor");
    if (participantMembers.length >= maxTeamMembers) {
      return NextResponse.json(
        { error: `Team is full (maximum ${maxTeamMembers} members)` },
        { status: 400 }
      );
    }

    // Role-limit check driven by contest.roleConfig (no hardcoded ROLE_LIMITS)
    const roleConfig = (contest?.roleConfig as Array<{ role: string; maxPerTeam: number }> | null) ?? [];
    const newRole = existingCu?.participantRole ?? userToAdd.role ?? null;
    if (newRole) {
      const limit = roleConfig.find((r) => r.role === newRole)?.maxPerTeam;
      if (limit !== undefined) {
        // Mentors exempt from per-role caps.
        const countInRole = participantMembers.filter((m) => m.participantRole === newRole).length;
        if (countInRole >= limit) {
          return NextResponse.json(
            { error: `Maximum ${limit} ${newRole}(s) allowed in a team` },
            { status: 400 }
          );
        }
      }
    }

    // Upsert contest_users row
    if (existingCu) {
      await db
        .update(contestUsers)
        .set({ teamId })
        .where(eq(contestUsers.id, existingCu.id));
    } else {
      await db.insert(contestUsers).values({
        contestId: az.defaultContestId,
        userId,
        role: "participant",
        participantRole: userToAdd.role ?? null,
        teamId,
      });
    }

    return NextResponse.json({ message: "Member added successfully" }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
