/**
 * One-shot backfill: turn the legacy JUDGE_EMAILS list into real contest_users rows
 * against the default contest. Idempotent — skips anyone already enrolled.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npx tsx scripts/seed-legacy-judges.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { users, contestUsers, contests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { LEGACY_JUDGE_EMAIL_SEED } from "@/lib/constants";

async function main() {
  const defaultContest = await db.query.contests.findFirst({
    where: eq(contests.isDefault, true),
  });
  if (!defaultContest) {
    console.error("No contest flagged isDefault=true; bailing.");
    process.exit(1);
  }
  console.log(`Default contest: ${defaultContest.slug} (${defaultContest.id})`);

  let inserted = 0;
  let skipped = 0;
  for (const email of LEGACY_JUDGE_EMAIL_SEED) {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      console.warn(`  skip: no user with email ${email}`);
      skipped++;
      continue;
    }
    const existing = await db.query.contestUsers.findFirst({
      where: and(
        eq(contestUsers.contestId, defaultContest.id),
        eq(contestUsers.userId, user.id),
      ),
    });
    if (existing) {
      console.log(`  skip: ${email} already has role=${existing.role}`);
      skipped++;
      continue;
    }
    await db.insert(contestUsers).values({
      contestId: defaultContest.id,
      userId: user.id,
      role: "judge",
    });
    console.log(`  ✓ added ${email} as judge`);
    inserted++;
  }

  console.log(`\nDone. inserted=${inserted} skipped=${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
