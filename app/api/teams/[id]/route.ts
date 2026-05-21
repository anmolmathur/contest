import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, contestUsers, submissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireLegacyRead, requireLegacyJudge, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

async function loadScopedTeam(id: string, defaultContestId: string) {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!team) throw new LegacyAuthError(404, "Team not found");
  if (team.contestId !== defaultContestId) {
    throw new LegacyAuthError(403, "Team is not in your contest");
  }
  return team;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const az = await requireLegacyRead();
    const { id } = await params;
    const team = await loadScopedTeam(id, az.defaultContestId);

    // Members now come from contest_users (the new source of truth per contest)
    const memberLinks = await db.query.contestUsers.findMany({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        eq(contestUsers.teamId, id),
      ),
      with: {
        user: {
          columns: { id: true, name: true, email: true, department: true },
        },
      },
    });

    const members = memberLinks
      .filter((m) => m.user)
      .map((m) => ({
        id: m.user!.id,
        name: m.user!.name,
        email: m.user!.email,
        role: m.participantRole,
        department: m.user!.department,
      }));

    return NextResponse.json({ team, members }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const az = await requireLegacyRead();
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen");

    const { id } = await params;
    const body = await req.json();
    const { name, track } = body;

    const team = await loadScopedTeam(id, az.defaultContestId);
    const isCreator = team.createdBy === az.userId;

    if (!isCreator && !az.isJudge) {
      return NextResponse.json(
        { error: "Only team creator or admin can update the team" },
        { status: 403 }
      );
    }

    // Non-admin team-creator edits are disallowed after any submission exists.
    if (!az.isJudge) {
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

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined && name.trim() !== "") updateData.name = name.trim();
    if (track !== undefined) updateData.track = track;

    const [updatedTeam] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json({ message: "Team updated successfully", team: updatedTeam });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "23505") {
      return NextResponse.json({ error: "Team name already exists" }, { status: 400 });
    }
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const az = await requireLegacyJudge();
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is frozen");

    const { id } = await params;
    const team = await loadScopedTeam(id, az.defaultContestId);
    const isCreator = team.createdBy === az.userId;

    if (!isCreator && !az.isJudge) {
      return NextResponse.json(
        { error: "Only team creator or admin can delete the team" },
        { status: 403 }
      );
    }

    if (!az.isJudge) {
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

    // Unlink members from this team via contest_users (NOT the legacy users.teamId)
    await db
      .update(contestUsers)
      .set({ teamId: null })
      .where(and(eq(contestUsers.contestId, az.defaultContestId), eq(contestUsers.teamId, id)));

    await db.delete(teams).where(eq(teams.id, id));

    return NextResponse.json({ message: "Team deleted successfully" });
  } catch (error) {
    return errorResponse(error);
  }
}
