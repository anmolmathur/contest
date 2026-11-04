import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveContest, canJudgeContest } from "@/lib/contest-auth";
import { withFullRosters } from "@/lib/multi-team";

export async function GET(
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

    // Verify user is a judge or admin for this contest
    const canView = await canJudgeContest(session.user.id, contest.id, session.user.email ?? undefined);
    if (!canView) {
      return NextResponse.json(
        { error: "Only judges and admins can access all teams" },
        { status: 403 }
      );
    }

    // Get all teams for this contest with their members and submissions
    const teamsWithData = await withFullRosters(contest, await db.query.teams.findMany({
      where: eq(teams.contestId, contest.id),
      with: {
        members: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        contestMembers: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        submissions: true,
        trackRef: true,
      },
    }));

    // `members` used to come from the legacy users.team_id column, which is
    // global (not per contest) and could disagree with contest_users — the
    // admin panel then showed people on a team their own dashboard didn't
    // show. Derive it from the contest-scoped roster instead.
    const teamsOut = teamsWithData.map((t) => ({
      ...t,
      members: t.contestMembers
        .filter((cu) => cu.user)
        .map((cu) => ({ id: cu.user!.id, name: cu.user!.name, email: cu.user!.email, role: cu.role })),
    }));

    return NextResponse.json({ teams: teamsOut }, { status: 200 });
  } catch (error) {
    console.error("Get all teams error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
