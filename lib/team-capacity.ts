/**
 * Team size + per-role cap checks, shared by every path that puts a
 * participant into a team or changes their team role:
 *   teams/add-member, team-invitations accept, users/me PUT.
 *
 * Mentors never count: not against `contests.maxTeamMembers`, not against
 * any `contests.roleConfig` cap.
 */
import { db } from "@/lib/db";
import { contestUsers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export interface RoleCap {
  role: string;
  maxPerTeam: number;
}

export function roleConfigOf(raw: unknown): RoleCap[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RoleCap[]).filter((r) => r && typeof r.role === "string" && r.role.trim() !== "");
}

/** Participants (non-mentors) currently on a team in a contest. */
export async function teamParticipants(contestId: string, teamId: string) {
  const rows = await db.query.contestUsers.findMany({
    where: and(eq(contestUsers.teamId, teamId), eq(contestUsers.contestId, contestId)),
    columns: { id: true, userId: true, role: true, participantRole: true },
  });
  return rows.filter((r) => r.role !== "mentor");
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
  mode: "join" | "roleChange";
}): Promise<string | null> {
  const { contest, teamId, userId, participantRole, mode } = opts;
  const others = (await teamParticipants(contest.id, teamId)).filter((m) => m.userId !== userId);

  if (mode === "join" && others.length >= contest.maxTeamMembers) {
    return `Team is full (maximum ${contest.maxTeamMembers} members)`;
  }

  if (participantRole) {
    const cap = roleConfigOf(contest.roleConfig).find((rc) => rc.role === participantRole);
    if (cap) {
      const current = others.filter((m) => m.participantRole === participantRole).length;
      if (current >= cap.maxPerTeam) {
        return `Maximum ${cap.maxPerTeam} ${participantRole}(s) allowed per team`;
      }
    }
  }
  return null;
}
