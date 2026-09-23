/**
 * Absolute URL helpers (for emails and anything leaving the browser).
 *
 * A contest on a verified custom domain is addressed on that domain;
 * everything else uses the platform's canonical host.
 */
export function platformBaseUrl(fallbackOrigin?: string | null): string {
  const canonical = process.env.PLATFORM_CANONICAL_HOST?.trim();
  if (canonical) return canonical.startsWith("http") ? canonical.replace(/\/$/, "") : `https://${canonical}`;
  const nextauth = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  if (nextauth) return nextauth.replace(/\/$/, "");
  return (fallbackOrigin ?? "http://localhost:3000").replace(/\/$/, "");
}

export function contestBaseUrl(contest: {
  slug: string;
  customDomain?: string | null;
  customDomainVerifiedAt?: Date | string | null;
}): { base: string; onCustomDomain: boolean } {
  if (contest.customDomain && contest.customDomainVerifiedAt) {
    return { base: `https://${contest.customDomain}`, onCustomDomain: true };
  }
  return { base: `${platformBaseUrl()}/c/${contest.slug}`, onCustomDomain: false };
}

/** Absolute URL to a page inside a contest, e.g. contestUrl(c, "/dashboard"). */
export function contestUrl(
  contest: { slug: string; customDomain?: string | null; customDomainVerifiedAt?: Date | string | null },
  path = "",
): string {
  return `${contestBaseUrl(contest).base}${path}`;
}
