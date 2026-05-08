import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, contestUsers } from "@/lib/db/schema";
import { eq, and, notInArray, isNotNull } from "drizzle-orm";
import { legacyAuthz, errorResponse, LegacyAuthError } from "@/lib/legacy-auth";

/**
 * List users who are not yet on a team in the default contest.
 *
 * Previously this queried `users WHERE teamId IS NULL` which is wrong in a
 * multi-tenant world — a user could be on Contest A's team but still be
 * "available" for Contest B. We now compute availability per-contest against
 * `contest_users`.
 */
export async function GET() {
  try {
    const az = await legacyAuthz();
    if (!az.canRead) throw new LegacyAuthError(403, "No access");

    // Users with an assigned team in the default contest.
    const takenLinks = await db.query.contestUsers.findMany({
      where: and(
        eq(contestUsers.contestId, az.defaultContestId),
        isNotNull(contestUsers.teamId),
      ),
      columns: { userId: true },
    });
    const takenIds = takenLinks.map((r) => r.userId);

    // All other users are available to join a team in this contest.
    const availableUsers = await db.query.users.findMany({
      where: takenIds.length > 0 ? notInArray(users.id, takenIds) : undefined,
      columns: { id: true, name: true, email: true, role: true, department: true },
    });

    return NextResponse.json({ users: availableUsers }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
