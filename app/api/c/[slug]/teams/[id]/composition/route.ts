import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contestUsers, problemStatements, stageDecisions, teams, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getEffectiveContestRole, resolveContest } from "@/lib/contest-auth";
import { compositionChecks } from "@/lib/team-composition";
import { extraRolesOf } from "@/lib/team-capacity";

/**
 * GET /api/c/[slug]/teams/[id]/composition
 * Team members (with all roles + department), the composition checklist,
 * the claimed problem, declared solution paths and gate decisions.
 * Visible to the team's own members/mentor, jury, validators and admins.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { slug, id } = await params;
    const contest = await resolveContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    const eff = await getEffectiveContestRole(session.user.id, contest.id);
    const staff = eff.access === "admin" || eff.access === "judge" || eff.access === "validator";
    if (!staff && eff.teamId !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const team = await db.query.teams.findFirst({ where: and(eq(teams.id, id), eq(teams.contestId, contest.id)) });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const rows = await db
      .select({
        userId: contestUsers.userId,
        role: contestUsers.role,
        participantRole: contestUsers.participantRole,
        extraRoles: contestUsers.extraRoles,
        name: users.name,
        department: users.department,
      })
      .from(contestUsers)
      .innerJoin(users, eq(users.id, contestUsers.userId))
      .where(and(eq(contestUsers.contestId, contest.id), eq(contestUsers.teamId, id)));
    const members = rows.filter((r) => r.role !== "mentor" && r.role !== "validator");

    const problem = team.problemId
      ? await db.query.problemStatements.findFirst({
          where: eq(problemStatements.id, team.problemId),
          columns: { id: true, title: true, description: true, metricTemplate: true, trackId: true },
        })
      : null;
    const decisions = await db.query.stageDecisions.findMany({ where: eq(stageDecisions.teamId, id) });

    return NextResponse.json({
      teamId: team.id,
      status: team.status,
      solutionPaths: Array.isArray(team.solutionPaths) ? team.solutionPaths : [],
      problem,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.name,
        department: m.department,
        roles: [m.participantRole, ...extraRolesOf(m.extraRoles)].filter((r, i, a): r is string => !!r && a.indexOf(r) === i),
      })),
      mentors: rows.filter((r) => r.role === "mentor").map((m) => ({ userId: m.userId, name: m.name })),
      checks: compositionChecks(contest, members),
      decisions: decisions.map((d) => ({ phase: d.phase, decision: d.decision, conditions: d.conditions, decidedAt: d.decidedAt })),
    });
  } catch (error) {
    console.error("Error loading team composition:", error);
    return NextResponse.json({ error: "Failed to load team composition" }, { status: 500 });
  }
}
