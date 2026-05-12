import { db } from "@/lib/db";
import { contests, contestUsers, users, teams } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type ContestRole = "admin" | "judge" | "participant" | "mentor";

/**
 * Mentors are attached to a team but do NOT count as participants:
 *  - They don't submit, don't get judged, don't have their score aggregated.
 *  - They don't count against `contests.maxTeamMembers` or against any
 *    per-role limits in `contests.roleConfig`.
 *  - They can read team content (dashboard, submissions) but can't mutate.
 *  - A single user may be a mentor for multiple teams across contests —
 *    but still only one `contest_users` row per (contest, user).
 *
 * To mentor multiple teams in the same contest you'd need multiple rows;
 * we take a simpler route: one contest_user row with role='mentor' whose
 * `teamId` points at the team they're currently assigned to. Admins can
 * reassign.
 */

/**
 * EffectiveContestRole — what a user can actually do inside a contest.
 *
 * This split is central to the RBAC model:
 *  - `access` = what actions are permitted in this contest
 *  - `source` = where that permission came from (contest-specific role
 *               or an implicit platform-admin override)
 *
 * Platform admins get `inspect` here — read-only visibility into any contest
 * — when they aren't in `contest_users`. But for admin-level mutations
 * (archive, edit settings, manage tracks/users/teams, etc.) `canAdminContest`
 * additionally grants platform admins access, since platform_admin is a
 * global superuser role. To **judge** a contest (submit scores) they must
 * still be explicitly added to contest_users for impartiality.
 */
export type EffectiveContestRole = {
  // 'mentor' means attached to a team as an advisor — read-only, doesn't
  // participate or judge. See the ContestRole docs above.
  access: "none" | "inspect" | "participant" | "judge" | "admin" | "mentor";
  source: "contest_users" | "platform_override" | "none";
  participantRole: string | null;
  teamId: string | null;
};

/**
 * Get a contest by its slug
 */
export async function getContestBySlug(slug: string) {
  return db.query.contests.findFirst({
    where: eq(contests.slug, slug),
  });
}

/**
 * Get a contest by its ID
 */
export async function getContestById(id: string) {
  return db.query.contests.findFirst({
    where: eq(contests.id, id),
  });
}

/**
 * Get a user's contest_users record for a specific contest
 */
export async function getContestUser(userId: string, contestId: string) {
  return db.query.contestUsers.findFirst({
    where: and(
      eq(contestUsers.userId, userId),
      eq(contestUsers.contestId, contestId),
    ),
  });
}

/**
 * Get a user's raw role in a specific contest (no platform override).
 */
export async function getUserContestRole(userId: string, contestId: string): Promise<ContestRole | null> {
  const contestUser = await getContestUser(userId, contestId);
  return (contestUser?.role as ContestRole) ?? null;
}

/**
 * Check if user is a platform admin (global role).
 * Platform admin = access to /platform/admin console + ability to inspect any contest.
 * It does NOT by itself grant judge/admin rights inside any specific contest.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { globalRole: true },
  });
  if (!user) return false;
  return user.globalRole === "platform_admin";
}

/**
 * Core RBAC resolver. Returns the effective role a user has in a contest.
 *
 * A platform admin who is NOT listed in contest_users for this contest gets
 * `access: "inspect"` — they can see dashboards and data but cannot mutate.
 * To take action (judge, admin), they must be explicitly added.
 */
export async function getEffectiveContestRole(
  userId: string,
  contestId: string,
): Promise<EffectiveContestRole> {
  const contestUser = await getContestUser(userId, contestId);
  if (contestUser) {
    return {
      access: contestUser.role as ContestRole,
      source: "contest_users",
      participantRole: contestUser.participantRole ?? null,
      teamId: contestUser.teamId ?? null,
    };
  }

  const platformAdmin = await isPlatformAdmin(userId);
  if (platformAdmin) {
    return {
      access: "inspect",
      source: "platform_override",
      participantRole: null,
      teamId: null,
    };
  }

  return { access: "none", source: "none", participantRole: null, teamId: null };
}

/**
 * True iff user can administer the contest (mutating admin actions).
 * Platform-admin alone does NOT satisfy this — must be explicitly added.
 */
export async function isContestAdmin(userId: string, contestId: string): Promise<boolean> {
  const eff = await getEffectiveContestRole(userId, contestId);
  return eff.source === "contest_users" && eff.access === "admin";
}

/**
 * True iff user can judge this contest (mutating judge actions: submit scores).
 * Platform-admin alone does NOT satisfy this.
 */
export async function isContestJudge(userId: string, contestId: string): Promise<boolean> {
  const eff = await getEffectiveContestRole(userId, contestId);
  return eff.source === "contest_users" && (eff.access === "judge" || eff.access === "admin");
}

/**
 * True iff user is an enrolled participant in this contest.
 */
export async function isContestParticipant(userId: string, contestId: string): Promise<boolean> {
  const eff = await getEffectiveContestRole(userId, contestId);
  return eff.access === "participant";
}

/**
 * True iff user is assigned as a mentor in this contest.
 * (Mentors read-only — they see team content but don't submit/judge/admin.)
 */
export async function isContestMentor(userId: string, contestId: string): Promise<boolean> {
  const eff = await getEffectiveContestRole(userId, contestId);
  return eff.access === "mentor";
}

/**
 * True iff user has any explicit role in the contest (admin/judge/participant),
 * excluding platform-admin inspect override. Use this to gate per-contest UI that
 * should only show to real members.
 */
export async function isContestMember(userId: string, contestId: string): Promise<boolean> {
  const eff = await getEffectiveContestRole(userId, contestId);
  return eff.source === "contest_users";
}

/**
 * True iff the caller is allowed to READ contest data (includes platform-admin inspect).
 * Use this for read-only endpoints so platform admins can still see dashboards.
 */
export async function canReadContest(userId: string, contestId: string): Promise<boolean> {
  const eff = await getEffectiveContestRole(userId, contestId);
  return eff.access !== "none";
}

/**
 * True iff the caller is allowed to MUTATE contest data as an admin.
 *
 * Platform admins satisfy this for any contest, even when they aren't in
 * `contest_users` — platform_admin is a global superuser role that can take
 * any action in the system (archive, edit, manage users/teams/tracks, etc.).
 * Contest-scoped admins (via `contest_users`) also satisfy this.
 *
 * Use `isContestAdmin` instead if you specifically need the narrower "is in
 * contest_users as admin" check.
 *
 * The 3rd `_userEmail` parameter is accepted for back-compat with the
 * pre-refactor call sites and ignored — authz is now driven purely by the
 * `contest_users` table plus the global platform_admin role, not legacy
 * email lists.
 */
export async function canAdminContest(
  userId: string,
  contestId: string,
  _userEmail?: string,
): Promise<boolean> {
  if (await isContestAdmin(userId, contestId)) return true;
  return isPlatformAdmin(userId);
}

/**
 * True iff the caller is allowed to MUTATE contest data as a judge (or admin).
 * Platform-admin alone is NOT enough. See `canAdminContest` re: `_userEmail`.
 */
export async function canJudgeContest(
  userId: string,
  contestId: string,
  _userEmail?: string,
): Promise<boolean> {
  return isContestJudge(userId, contestId);
}

/**
 * Archived/completed contests are immutable. All mutating endpoints should call
 * this guard to return a 409 for any write attempt on a frozen contest.
 */
export async function isContestMutable(contestId: string): Promise<boolean> {
  const contest = await getContestById(contestId);
  if (!contest) return false;
  return contest.status !== "completed" && contest.status !== "archived";
}

/**
 * Get user's team in a specific contest
 */
export async function getUserTeamInContest(userId: string, contestId: string) {
  const contestUser = await getContestUser(userId, contestId);
  if (!contestUser?.teamId) return null;

  return db.query.teams.findFirst({
    where: eq(teams.id, contestUser.teamId),
  });
}

/**
 * Resolve a contest from a slug route parameter.
 */
export async function resolveContest(slug: string) {
  const contest = await getContestBySlug(slug);
  if (!contest) return null;
  return contest;
}

/**
 * Resolve the "default" contest for legacy non-scoped routes.
 *
 * The pre-multi-tenant UI (/dashboard, /admin, /judging, /api/teams/all, etc.)
 * predates slug-based routing. Those routes now transparently resolve to the one
 * contest marked `isDefault = true`. If no default is set, we fall back to the
 * oldest `active` contest, and finally to any contest at all. Returns null only
 * if the database has zero contests.
 */
export async function getDefaultContest() {
  const byFlag = await db.query.contests.findFirst({
    where: eq(contests.isDefault, true),
  });
  if (byFlag) return byFlag;

  const byStatus = await db.query.contests.findFirst({
    where: eq(contests.status, "active"),
    orderBy: (c, { asc }) => [asc(c.createdAt)],
  });
  if (byStatus) return byStatus;

  return db.query.contests.findFirst({
    orderBy: (c, { asc }) => [asc(c.createdAt)],
  });
}
