/**
 * reset-passwords.mjs
 *
 * Called by sync.sh after a successful import when --reset-passwords PW is
 * used. Rewrites every users.password to a bcrypt hash of PW, so you can
 * log in as any synced user during testing. Idempotent.
 *
 * Run directly:
 *   node scripts/sync-from-prod/reset-passwords.mjs \
 *     "postgres://..." "my-dev-password"
 *
 * Dependencies: bcryptjs (already a project dep) and pg (installed ad hoc
 * if not present; falls back to shelling out to psql).
 */

import bcrypt from "bcryptjs";
import { spawnSync } from "node:child_process";

const [, , databaseUrl, plaintext] = process.argv;
if (!databaseUrl || !plaintext) {
  console.error("Usage: reset-passwords.mjs <DATABASE_URL> <plaintext>");
  process.exit(1);
}
if (plaintext.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const hash = await bcrypt.hash(plaintext, 10);

// Use psql (already required by sync.sh) so we don't need an extra
// Node Postgres client on PATH. The hash is bcrypt, no special chars
// beyond $ and . — still quote defensively.
const sql = `UPDATE users SET password = '${hash.replace(/'/g, "''")}', updated_at = NOW();`;

const r = spawnSync(
  "psql",
  [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql],
  { stdio: ["ignore", "inherit", "inherit"] },
);

if (r.status !== 0) {
  console.error("psql failed while resetting passwords.");
  process.exit(r.status ?? 1);
}

console.log(`  ✓ Reset password for every user to the supplied value.`);
