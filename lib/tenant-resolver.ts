/**
 * Tenant resolver: map an incoming HTTP host → contest slug.
 *
 * Gated behind `ENABLE_CUSTOM_DOMAINS=true`. Production proxies (Caddy,
 * Traefik, Cloudflare for SaaS, etc.) call `/api/tls-ask?host=X` to decide
 * whether to issue a cert for X; that endpoint also uses this resolver.
 *
 * A thin in-memory cache amortizes the DB hit across requests. For single-node
 * dev this is fine. For multi-node prod you'd swap the Map for Redis.
 */

import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";

const CACHE_TTL_MS = 60_000;
type CacheEntry = { slug: string | null; expiresAt: number };
const hostCache = new Map<string, CacheEntry>();

export function customDomainsEnabled(): boolean {
  return process.env.ENABLE_CUSTOM_DOMAINS === "true";
}

function normalizeHost(host: string | null): string | null {
  if (!host) return null;
  // strip port, lowercase
  return host.split(":")[0].toLowerCase();
}

/**
 * Given an HTTP Host header, return the contest slug that owns that host.
 * Returns null if the host is the apex platform domain, localhost, or
 * any other non-custom-domain value.
 */
export async function resolveHostToSlug(rawHost: string | null): Promise<string | null> {
  if (!customDomainsEnabled()) return null;
  const host = normalizeHost(rawHost);
  if (!host) return null;
  if (host === "localhost" || host.endsWith(".local")) return null;

  // Platform apex — anything listed in PLATFORM_DOMAINS (comma-separated env var)
  const apexList = (process.env.PLATFORM_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (apexList.includes(host)) return null;

  const now = Date.now();
  const cached = hostCache.get(host);
  if (cached && cached.expiresAt > now) return cached.slug;

  const contest = await db.query.contests.findFirst({
    where: eq(contests.customDomain, host),
    columns: { slug: true, customDomainVerifiedAt: true },
  });
  // Only rewrite when domain is verified (so pre-verification DNS doesn't break).
  const slug = contest?.customDomainVerifiedAt ? contest.slug : null;
  hostCache.set(host, { slug, expiresAt: now + CACHE_TTL_MS });
  return slug;
}

/** List every verified custom domain (for TLS-ask / admin UI). */
export async function listVerifiedDomains(): Promise<string[]> {
  const rows = await db.query.contests.findMany({
    where: isNotNull(contests.customDomainVerifiedAt),
    columns: { customDomain: true },
  });
  return rows.map((r) => r.customDomain).filter(Boolean) as string[];
}

/** Bust the cache for a specific host (called after verification toggles). */
export function invalidateHostCache(host: string | null) {
  if (!host) return hostCache.clear();
  hostCache.delete(normalizeHost(host) ?? "");
}
