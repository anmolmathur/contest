import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq, count, and } from "drizzle-orm";
import { requireLegacyJudge, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

export async function POST(req: NextRequest) {
  try {
    const az = await requireLegacyJudge();
    if (!az.isMutable) throw new LegacyAuthError(409, "Contest is completed or archived; approvals are frozen");

    const body = await req.json();
    const { teamId, approved } = body;

    if (!teamId || typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Tenant isolation: the team must belong to the default contest
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (team.contestId !== az.defaultContestId) {
      return NextResponse.json({ error: "Team is not in your contest" }, { status: 403 });
    }

    // Resolve max-approved-teams from the contest config (not a hardcoded constant).
    const { getContestById } = await import("@/lib/contest-auth");
    const contest = await getContestById(az.defaultContestId);
    const maxApproved = contest?.maxApprovedTeams ?? 10;

    if (approved) {
      const [approvedCountResult] = await db
        .select({ count: count() })
        .from(teams)
        .where(and(eq(teams.approved, true), eq(teams.contestId, az.defaultContestId)));

      if (approvedCountResult.count >= maxApproved) {
        return NextResponse.json(
          { error: `Maximum approved team limit (${maxApproved}) reached` },
          { status: 400 }
        );
      }
    }

    const [updatedTeam] = await db
      .update(teams)
      .set({ approved, updatedAt: new Date() })
      .where(eq(teams.id, teamId))
      .returning();

    return NextResponse.json(
      {
        message: `Team ${approved ? "approved" : "unapproved"} successfully`,
        team: updatedTeam,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
