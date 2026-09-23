/**
 * Tiny in-memory fixed-window rate limiter for the AI endpoints.
 *
 * Per-process only (fine for the single-container deployment); keys are
 * "u:<userId>" for signed-in callers and "ip:<address>" for anonymous ones.
 */
import type { NextRequest } from "next/server";

type Bucket = { count: number; windowStart: number };

const BUCKETS = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000 && BUCKETS.size < 10_000) return;
  lastSweep = now;
  for (const [k, b] of BUCKETS) {
    // Longest window we use is 1h; anything older is dead.
    if (now - b.windowStart > 3_600_000) BUCKETS.delete(k);
  }
}

/** Returns true when the call is allowed (and counts it). */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const id = `${key}|${windowMs}`;
  const b = BUCKETS.get(id);
  if (!b || now - b.windowStart > windowMs) {
    BUCKETS.set(id, { count: 1, windowStart: now });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

/** Apply several windows at once (e.g. per-minute AND per-hour). All must pass. */
export function checkRateLimits(key: string, limits: Array<{ max: number; windowMs: number }>): boolean {
  return limits.every((l) => checkRateLimit(key, l.max, l.windowMs));
}

/** Best-effort client IP (behind Cloudflare / reverse proxy). */
export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
