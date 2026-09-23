/**
 * Where should a user land after signing in (or when hitting "/")?
 *
 *  1. On a verified custom domain → that contest ("/dashboard", host-relative).
 *  2. Enrolled in exactly one active contest → its dashboard.
 *  3. Exactly one active contest overall → its dashboard.
 *  4. Otherwise the Innovation Hub list ("/").
 */
import { db } from "@/lib/db";
import { contests, contestUsers } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { resolveHostToSlug } from "@/lib/tenant-resolver";

export async function postLoginDestination(userId: string | null, host: string | null): Promise<string> {
  const hostSlug = await resolveHostToSlug(host);
  if (hostSlug) return "/dashboard";

  const active = await db.query.contests.findMany({
    where: eq(contests.status, "active"),
    columns: { id: true, slug: true },
  });
  if (userId && active.length > 0) {
    const mine = await db.query.contestUsers.findMany({
      where: and(
        eq(contestUsers.userId, userId),
        inArray(
          contestUsers.contestId,
          active.map((c) => c.id),
        ),
      ),
      columns: { contestId: true },
    });
    if (mine.length === 1) {
      const c = active.find((a) => a.id === mine[0].contestId);
      if (c) return `/c/${c.slug}/dashboard`;
    }
  }
  if (active.length === 1) return `/c/${active[0].slug}/dashboard`;
  return "/";
}
