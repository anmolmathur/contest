/**
 * Password reset token helpers.
 *
 * Design:
 *   - Token is 32 cryptographically random bytes, base64url-encoded (≈43 chars).
 *     This is what gets emailed to the user.
 *   - Only SHA-256(token) is stored in the DB. A leaked DB dump therefore
 *     does NOT yield usable reset links — an attacker would need to invert
 *     SHA-256 to recover the raw token they could then hand to the
 *     reset-password endpoint.
 *   - Tokens are single-use (used_at) and expire after TOKEN_TTL_MINUTES.
 *   - Rate limit: refuse to issue a new token for an email if a still-valid
 *     unused token was issued within the cooldown window. This keeps the
 *     forgot-password endpoint from becoming an email-bombing primitive.
 *
 * This module is server-only — it imports node:crypto.
 */

import crypto from "node:crypto";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

export const TOKEN_TTL_MINUTES = 60;
export const RESEND_COOLDOWN_SECONDS = 60;
/** Teammates added by email may not open their inbox for days. */
export const INVITE_TOKEN_TTL_MINUTES = 7 * 24 * 60;

/** Generate a fresh raw token (to email) and its SHA-256 hash (to store). */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/** Re-derive the stored hash from a raw token presented at the reset endpoint. */
export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a new reset token for `email`. Returns the raw token if a user was
 * found and within rate-limit; null otherwise. Callers MUST NOT leak which
 * branch happened — this is just internal bookkeeping. The caller's response
 * to the client is identical in both cases (anti-enumeration).
 */
export async function issueResetTokenForEmail(
  emailLower: string,
  ttlMinutes: number = TOKEN_TTL_MINUTES,
): Promise<{ raw: string; userId: string; userName: string | null; userEmail: string } | null> {
  // Case-insensitive: older accounts were stored with mixed-case emails, and
  // an exact match silently skipped them (no reset email was ever sent).
  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${emailLower.trim().toLowerCase()}`,
  });
  if (!user) return null;

  // Rate-limit: if the user already has a fresh unused token within the
  // cooldown window, refuse to mint a new one. We still return null so the
  // outer endpoint can keep a constant response shape.
  const recent = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.userId, user.id),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.createdAt, new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000)),
    ),
    orderBy: [desc(passwordResetTokens.createdAt)],
  });
  if (recent) return null;

  const { raw, hash } = generateResetToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hash,
    expiresAt,
  });

  return { raw, userId: user.id, userName: user.name ?? null, userEmail: user.email };
}

export type ConsumeTokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "already_used" };

/**
 * Validate and atomically consume a token. Returns the userId on success.
 * Caller is responsible for then bcrypt-hashing the new password and updating
 * users.password in the same logical operation.
 */
export async function consumeResetToken(rawToken: string): Promise<ConsumeTokenResult> {
  const hash = hashResetToken(rawToken);

  const row = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, hash),
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.usedAt) return { ok: false, reason: "already_used" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  // Mark used. Use a conditional update so we don't race with a concurrent
  // reset using the same token — the second one will affect 0 rows.
  const result = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });

  if (result.length === 0) return { ok: false, reason: "already_used" };
  return { ok: true, userId: row.userId };
}

/** Convenience: hide whether an email is registered by always taking ~ same time. */
export async function constantTimeDummy(): Promise<void> {
  // bcrypt.compare against a fixed hash takes ~50–100ms; we approximate that
  // with a synchronous random-bytes generation so the forgot-password endpoint
  // doesn't return obviously faster for unknown emails.
  crypto.randomBytes(32);
  await new Promise((r) => setTimeout(r, 40));
}
