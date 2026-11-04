/**
 * Multi-team membership (Ideathon only).
 *
 * In most contests a person is on at most one team, held in
 * `contest_users.team_id`. Ideathon contests let one person sit on several
 * teams. There:
 *   - `team_members` holds one row per (team, user) for EVERY team they're on;
 *   - `contest_users.team_id` is their *active* team: the one the dashboard
 *     shows and every per-user check (submissions, metrics, problems…) uses.
 *     They switch it from the dashboard (PUT /users/me { activeTeamId }).
 *
 * Single-team contests never write `team_members`, so the queries below
 * reduce to the old `contest_users.team_id = X` check for them.
 */
import { db } from "@/lib/db";
import { contestUsers, teamMembers, teams, users } from "@/lib/db/schema";
import { and, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

export function allowsMultipleTeams(contest: { contestType?: string | null }): boolean {
  return contest.contestType === "ideathon";
}

/** WHERE condition on contest_users: the row belongs to a member of `teamId`. */
export function onTeam(teamId: string): SQL {
  return or(
    eq(contestUsers.teamId, teamId),
    sql`exists (select 1 from ${teamMembers} tm where tm.team_id = ${teamId} and tm.user_id = ${contestUsers.userId})`,
  )!;
}

/** WHERE condition on contest_users: the row belongs to a member of any of `teamIds`. */
export function onAnyTeam(teamIds: string[]): SQL {
  if (teamIds.length === 0) return sql`false`;
  return or(
    inArray(contestUsers.teamId, teamIds),
    sql`exists (select 1 from ${teamMembers} tm where tm.team_id in ${teamIds} and tm.user_id = ${contestUsers.userId})`,
  )!;
}

/** Record that `userId` is on `teamId` (no-op for single-team contests). */
export async function recordMembership(
  tx: Db,
  contest: { id: string; contestType?: string | null },
  teamId: string,
  userId: string,
): Promise<void> {
  if (!allowsMultipleTeams(contest)) return;
  await tx
    .insert(teamMembers)
    .values({ contestId: contest.id, teamId, userId })
    .onConflictDoNothing();
}

/** Every team id `userId` is on in this contest (active team first). */
export async function teamIdsOf(contestId: string, userId: string, activeTeamId?: string | null): Promise<string[]> {
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.contestId, contestId), eq(teamMembers.userId, userId)));
  const ids = rows.map((r) => r.teamId);
  return activeTeamId ? [activeTeamId, ...ids.filter((id) => id !== activeTeamId)] : ids;
}

/** Teams (id + name) the user is on in this contest, active first. */
export async function teamsOf(contestId: string, userId: string, activeTeamId?: string | null) {
  const ids = await teamIdsOf(contestId, userId, activeTeamId);
  if (ids.length === 0) return [];
  const rows = await db.query.teams.findMany({
    where: inArray(teams.id, ids),
    columns: { id: true, name: true, status: true },
  });
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
}

/** Is `userId` on `teamId`? Covers both the active team and extra memberships. */
export async function isOnTeam(
  contestUser: { userId: string; teamId: string | null } | null | undefined,
  teamId: string,
): Promise<boolean> {
  if (!contestUser) return false;
  if (contestUser.teamId === teamId) return true;
  const row = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, contestUser.userId)),
    columns: { id: true },
  });
  return !!row;
}

/**
 * Take `userId` off `teamId`. If it was their active team, the active team
 * moves to another team they're still on (or none).
 */
export async function leaveTeam(tx: Db, contestId: string, teamId: string, userId: string): Promise<void> {
  await tx
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  const cu = await tx.query.contestUsers.findFirst({
    where: and(eq(contestUsers.contestId, contestId), eq(contestUsers.userId, userId)),
    columns: { id: true, teamId: true },
  });
  if (!cu || cu.teamId !== teamId) return;

  const next = await tx.query.teamMembers.findFirst({
    where: and(eq(teamMembers.contestId, contestId), eq(teamMembers.userId, userId), ne(teamMembers.teamId, teamId)),
    columns: { teamId: true },
  });
  const nextTeamId = next?.teamId ?? null;
  await tx.update(contestUsers).set({ teamId: nextTeamId }).where(eq(contestUsers.id, cu.id));
  await tx.update(users).set({ teamId: nextTeamId }).where(eq(users.id, userId));
}

/**
 * A team is being deleted: everyone whose active team it was moves to another
 * team they're on (or none). Call before deleting the team row.
 */
export async function reassignActiveTeam(tx: Db, contestId: string, teamId: string): Promise<void> {
  await tx.execute(sql`
    update ${contestUsers} cu
    set team_id = (
      select tm.team_id from ${teamMembers} tm
      where tm.contest_id = cu.contest_id and tm.user_id = cu.user_id and tm.team_id <> ${teamId}
      order by tm.created_at limit 1
    )
    where cu.contest_id = ${contestId} and cu.team_id = ${teamId}
  `);
  await tx.execute(sql`
    update ${users} u
    set team_id = (
      select cu.team_id from ${contestUsers} cu
      where cu.contest_id = ${contestId} and cu.user_id = u.id
    )
    where u.team_id = ${teamId}
  `);
}

/**
 * Members (contest_users rows + user) of each team, for routes that list
 * rosters. Same shape as the `teams.contestMembers` relation.
 */
export async function membersOfTeams(contestId: string, teamIds: string[]) {
  const out = new Map<string, Array<typeof contestUsers.$inferSelect & { user: { id: string; name: string | null; email: string; role: string | null } | null }>>();
  for (const id of teamIds) out.set(id, []);
  if (teamIds.length === 0) return out;

  const rows = await db.query.contestUsers.findMany({
    where: and(eq(contestUsers.contestId, contestId), onAnyTeam(teamIds)),
    with: { user: { columns: { id: true, name: true, email: true, role: true } } },
  });
  const extra = await db
    .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, teamIds));

  for (const row of rows) {
    const ids = new Set<string>();
    if (row.teamId && out.has(row.teamId)) ids.add(row.teamId);
    for (const e of extra) if (e.userId === row.userId) ids.add(e.teamId);
    for (const id of ids) out.get(id)!.push(row);
  }
  return out;
}

/**
 * Replace each team's `contestMembers` (built from contest_users.team_id) with
 * the full roster for multi-team contests. No-op for single-team contests.
 */
export async function withFullRosters<T extends { id: string; contestMembers: unknown[] }>(
  contest: { id: string; contestType?: string | null },
  list: T[],
): Promise<T[]> {
  if (!allowsMultipleTeams(contest) || list.length === 0) return list;
  const map = await membersOfTeams(contest.id, list.map((t) => t.id));
  return list.map((t) => ({ ...t, contestMembers: (map.get(t.id) ?? []) as T["contestMembers"] }));
}
