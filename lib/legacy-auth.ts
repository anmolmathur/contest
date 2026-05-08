/**
 * Legacy-auth shim.
 *
 * The original single-contest app lives at /dashboard, /admin, /judging and
 * hits /api/teams/*, /api/scores/*, /api/submissions/*, /api/certificates/*,
 * /api/users/* — none of which are contest-scoped.
 *
 * Rather than touch every one of those UI pages during this refactor, we
 * transparently bind the legacy surface to the "default contest" (the one
 * flagged `isDefault=true`). This preserves the current user experience for
 * the live hackathon while the multi-tenant architecture takes over.
 *
 * All auth in legacy handlers now goes through `legacyAuthz(session)` which
 * resolves the default contest, computes the caller's effective role, and
 * returns a typed verdict. Callers never touch JUDGE_EMAILS.
 */

import { auth } from "@/lib/auth";
import {
  getDefaultContest,
  getEffectiveContestRole,
  isContestMutable,
  type EffectiveContestRole,
} from "@/lib/contest-auth";
import type { Session } from "next-auth";

export type LegacyAuthz = {
  session: Session;
  userId: string;
  email: string;
  defaultContestId: string;
  defaultContestSlug: string;
  defaultContestStatus: string;
  role: EffectiveContestRole;
  /** True iff user is admin on the default contest (or platform-admin inspecting). */
  isAdmin: boolean;
  /** True iff user is a judge or admin on the default contest. */
  isJudge: boolean;
  /** True iff user is a participant on the default contest. */
  isParticipant: boolean;
  /** True iff user has ANY visibility into the default contest (incl. platform-admin inspect). */
  canRead: boolean;
  /** True iff mutations are allowed (not completed/archived). */
  isMutable: boolean;
};

export class LegacyAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Resolve legacy-route auth. Throws LegacyAuthError on failure so handlers
 * can use `try { ... } catch (e) { if (e instanceof LegacyAuthError) ... }`.
 */
export async function legacyAuthz(): Promise<LegacyAuthz> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new LegacyAuthError(401, "Unauthorized");
  }

  const contest = await getDefaultContest();
  if (!contest) {
    throw new LegacyAuthError(
      503,
      "No default contest configured. Platform admin must flag one contest as default.",
    );
  }

  const role = await getEffectiveContestRole(session.user.id, contest.id);
  const isAdmin = role.access === "admin" || role.access === "inspect";
  const isJudge = role.access === "judge" || role.access === "admin" || role.access === "inspect";
  const isParticipant = role.access === "participant";
  const mutable = await isContestMutable(contest.id);

  return {
    session,
    userId: session.user.id,
    email: session.user.email || "",
    defaultContestId: contest.id,
    defaultContestSlug: contest.slug,
    defaultContestStatus: contest.status,
    role,
    isAdmin: role.source === "contest_users" ? role.access === "admin" : isAdmin,
    // For mutating judge actions (submit/edit scores) platform-admin inspect is NOT enough.
    isJudge: role.source === "contest_users" ? (role.access === "judge" || role.access === "admin") : false,
    isParticipant,
    canRead: role.access !== "none",
    isMutable: mutable,
  };
}

/**
 * Shorthand: require judge power (for /api/scores/submit, /api/teams/approve etc.).
 * Returns the authz context or throws LegacyAuthError with the correct HTTP status.
 */
export async function requireLegacyJudge(): Promise<LegacyAuthz> {
  const az = await legacyAuthz();
  if (!az.isJudge) throw new LegacyAuthError(403, "Judge or admin role required");
  return az;
}

/**
 * Shorthand: require admin power.
 */
export async function requireLegacyAdmin(): Promise<LegacyAuthz> {
  const az = await legacyAuthz();
  if (!az.isAdmin) throw new LegacyAuthError(403, "Admin role required");
  // Platform-admin inspect is OK for read operations; admin-mutation callers
  // should also check `az.role.source === 'contest_users'` explicitly.
  return az;
}

/**
 * Shorthand: require at least read access to the default contest.
 */
export async function requireLegacyRead(): Promise<LegacyAuthz> {
  const az = await legacyAuthz();
  if (!az.canRead) throw new LegacyAuthError(403, "No access to default contest");
  return az;
}

/**
 * Convert a LegacyAuthError to a Response. Use in catch blocks.
 */
export function errorResponse(e: unknown) {
  if (e instanceof LegacyAuthError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("Unhandled legacy handler error:", e);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
