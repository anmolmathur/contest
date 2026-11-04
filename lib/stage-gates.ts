/**
 * Server-side rules that decide whether a team may submit for a stage
 * (Ideathon, but generic — contests without gates/metrics/composition rules
 * are unaffected):
 *   1. eliminated teams can't submit
 *   2. a later stage waits for the jury's Go / Go-with-changes at every
 *      earlier gate stage (phaseConfig[].gate)
 *   3. crew composition (roles, size, departments) — lib/team-composition.ts
 *   4. phaseConfig[].requires: validated baseline / actual impact metrics
 */
import { db } from "@/lib/db";
import { contestUsers, impactMetrics, stageDecisions, users } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { compositionChecks, compositionError, type CompositionMember } from "@/lib/team-composition";
import { term } from "@/lib/contest-config";
import { onTeam } from "@/lib/multi-team";

export interface GatePhase {
  phase: number;
  name: string;
  gate?: boolean;
  requires?: Array<"baseline" | "actual">;
}

export function phasesOf(phaseConfig: unknown): GatePhase[] {
  return (Array.isArray(phaseConfig) ? phaseConfig : []) as GatePhase[];
}

type ContestLike = {
  id: string;
  roleConfig: unknown;
  settings: unknown;
  maxTeamMembers: number;
  phaseConfig: unknown;
  terminology: unknown;
};

/** Team members (participants/admins, not mentors/validators) with their departments. */
export async function teamCompositionMembers(contestId: string, teamId: string): Promise<CompositionMember[]> {
  const rows = await db
    .select({
      role: contestUsers.role,
      participantRole: contestUsers.participantRole,
      extraRoles: contestUsers.extraRoles,
      department: users.department,
    })
    .from(contestUsers)
    .innerJoin(users, eq(users.id, contestUsers.userId))
    .where(and(eq(contestUsers.contestId, contestId), onTeam(teamId)));
  return rows.filter((r) => r.role !== "mentor" && r.role !== "validator");
}

export async function teamCompositionChecks(contest: ContestLike, teamId: string) {
  return compositionChecks(contest, await teamCompositionMembers(contest.id, teamId));
}

/** Returns a user-facing reason the team can't submit for `phase`, or null. */
export async function submissionBlocker(
  contest: ContestLike,
  team: { id: string; status?: string | null },
  phase: number,
): Promise<string | null> {
  const terminology = contest.terminology as Parameters<typeof term>[0];
  const teamWord = term(terminology, "team");
  const juryWord = term(terminology, "judge");
  const phases = phasesOf(contest.phaseConfig);

  if (team.status === "eliminated") {
    return `This ${teamWord.toLowerCase()} is out of the contest and can't submit any more.`;
  }

  const earlierGates = phases.filter((p) => p.gate && p.phase < phase);
  if (earlierGates.length > 0) {
    const decisions = await db.query.stageDecisions.findMany({
      where: and(eq(stageDecisions.teamId, team.id), inArray(stageDecisions.phase, earlierGates.map((g) => g.phase))),
    });
    for (const g of earlierGates) {
      const d = decisions.find((x) => x.phase === g.phase);
      if (!d) return `Waiting for the ${juryWord.toLowerCase()}'s decision on "${g.name}".`;
      if (d.decision === "out") return `This ${teamWord.toLowerCase()} did not pass "${g.name}".`;
    }
  }

  const compErr = compositionError(contest, await teamCompositionMembers(contest.id, team.id), teamWord);
  if (compErr) return compErr;

  const cfg = phases.find((p) => p.phase === phase);
  if (cfg?.requires?.length) {
    const metrics = await db.query.impactMetrics.findMany({
      where: and(eq(impactMetrics.contestId, contest.id), eq(impactMetrics.teamId, team.id)),
      columns: { baselineStatus: true, actualStatus: true },
    });
    const auditor = term(terminology, "validator");
    if (cfg.requires.includes("baseline") && !metrics.some((m) => m.baselineStatus === "validated")) {
      return `At least one baseline metric must be validated by an ${auditor} before you submit "${cfg.name}".`;
    }
    if (cfg.requires.includes("actual") && !metrics.some((m) => m.actualStatus === "validated")) {
      return `At least one actual (after) metric must be validated by an ${auditor} before you submit "${cfg.name}".`;
    }
  }
  return null;
}
