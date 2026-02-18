import { db } from "@/lib/db";
import { contests, contestUsers, users, teams } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type ContestRole = "admin" | "judge" | "participant";

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
 * Get a user's role in a specific contest
 */
export async function getUserContestRole(userId: string, contestId: string): Promise<ContestRole | null> {
  const contestUser = await db.query.contestUsers.findFirst({
    where: and(
      eq(contestUsers.userId, userId),
      eq(contestUsers.contestId, contestId),
    ),
  });
  return (contestUser?.role as ContestRole) ?? null;
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
 * Check if user is a platform admin (global role)
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
 * Check if user is a contest admin (or platform admin)
 */
export async function isContestAdmin(userId: string, contestId: string): Promise<boolean> {
  const platformAdmin = await isPlatformAdmin(userId);
  if (platformAdmin) return true;

  const role = await getUserContestRole(userId, contestId);
  return role === "admin";
}

/**
 * Check if user is a judge for a specific contest (or platform admin)
 */
export async function isContestJudge(userId: string, contestId: string): Promise<boolean> {
  const platformAdmin = await isPlatformAdmin(userId);
  if (platformAdmin) return true;

  const role = await getUserContestRole(userId, contestId);
  return role === "judge" || role === "admin";
}

/**
 * Check if user is a participant in a specific contest
 */
export async function isContestParticipant(userId: string, contestId: string): Promise<boolean> {
  const role = await getUserContestRole(userId, contestId);
  return role === "participant";
}

/**
 * Check if user has any role in a specific contest
 */
export async function isContestMember(userId: string, contestId: string): Promise<boolean> {
  const role = await getUserContestRole(userId, contestId);
  return role !== null;
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
 * Returns the contest or null if not found.
 */
export async function resolveContest(slug: string) {
  const contest = await getContestBySlug(slug);
  if (!contest) return null;
  return contest;
}

/**
 * Check if user is a judge or admin for a contest.
 * Uses per-contest roles from contest_users table + platform admin check.
 */
export async function canJudgeContest(userId: string, contestId: string, _userEmail?: string): Promise<boolean> {
  // Check contest-specific role
  const contestRole = await getUserContestRole(userId, contestId);
  if (contestRole === "judge" || contestRole === "admin") return true;

  // Check platform admin
  const platformAdmin = await isPlatformAdmin(userId);
  if (platformAdmin) return true;

  return false;
}

/**
 * Check if user can administrate a contest.
 * Uses per-contest roles from contest_users table + platform admin check.
 */
export async function canAdminContest(userId: string, contestId: string, _userEmail?: string): Promise<boolean> {
  // Check contest-specific role
  const contestRole = await getUserContestRole(userId, contestId);
  if (contestRole === "admin") return true;

  // Check platform admin
  const platformAdmin = await isPlatformAdmin(userId);
  if (platformAdmin) return true;

  return false;
}
