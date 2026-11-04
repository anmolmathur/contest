/**
 * Team size + per-role cap checks, shared by every path that puts a
 * participant into a team or changes their team role:
 *   teams/add-member, team-invitations accept, users/me PUT.
 *
 * Mentors and validators never count: not against `contests.maxTeamMembers`, not against
 * any `contests.roleConfig` cap.
 */
import { db } from "@/lib/db";
import { contestUsers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { onTeam } from "@/lib/multi-team";

export interface RoleCap {
  role: string;
  maxPerTeam: number;
  /** Ideathon: every role with minPerTeam ≥ 1 must be covered before submitting. */
  minPerTeam?: number;
  description?: string;
}

export function roleConfigOf(raw: unknown): RoleCap[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RoleCap[]).filter((r) => r && typeof r.role === "string" && r.role.trim() !== "");
}

/** Normalise the jsonb `contest_users.extra_roles` into a clean string list. */
export function extraRolesOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((r): r is string => typeof r === "string" && r.trim() !== "").map((r) => r.trim()))];
}

/** Every role a member plays: primary participantRole + extra roles. */
export function rolesOfMember(m: { participantRole?: string | null; extraRoles?: unknown }): string[] {
  const out = m.participantRole ? [m.participantRole] : [];
  for (const r of extraRolesOf(m.extraRoles)) if (!out.includes(r)) out.push(r);
  return out;
}

/** Participants (non-mentors) currently on a team in a contest. */
export async function teamParticipants(contestId: string, teamId: string) {
  const rows = await db.query.contestUsers.findMany({
    where: and(onTeam(teamId), eq(contestUsers.contestId, contestId)),
    columns: { id: true, userId: true, role: true, participantRole: true, extraRoles: true },
  });
  return rows.filter((r) => r.role !== "mentor" && r.role !== "validator");
}

/**
 * Returns a user-facing error if `userId` (holding `participantRole`) cannot
 * take a slot on `teamId`, or null if allowed.
 *
 * mode "join"       → user is joining: enforce team size AND role cap.
 * mode "roleChange" → user already on the team changes role: role cap only.
 */
export async function checkTeamSlot(opts: {
  contest: { id: string; maxTeamMembers: number; roleConfig: unknown };
  teamId: string;
  userId: string;
  participantRole: string | null | undefined;
  /** Additional roles the user plays (Ideathon multi-role). */
  extraRoles?: string[] | null;
  mode: "join" | "roleChange";
}): Promise<string | null> {
  const { contest, teamId, userId, participantRole, mode } = opts;
  const others = (await teamParticipants(contest.id, teamId)).filter((m) => m.userId !== userId);

  if (mode === "join" && others.length >= contest.maxTeamMembers) {
    return `Team is full (maximum ${contest.maxTeamMembers} members)`;
  }

  const mine = rolesOfMember({ participantRole, extraRoles: opts.extraRoles });
  const caps = roleConfigOf(contest.roleConfig);
  for (const role of mine) {
    const cap = caps.find((rc) => rc.role === role);
    if (!cap) continue;
    const current = others.filter((m) => rolesOfMember(m).includes(role)).length;
    if (current >= cap.maxPerTeam) {
      return `Maximum ${cap.maxPerTeam} ${role}(s) allowed per team`;
    }
  }
  return null;
}
