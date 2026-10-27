/**
 * Contest logos, stored in contests.brandingConfig as { url, name }:
 *   orgLogo    — host organisation / institution / university
 *   parentLogo — parent company / brand (e.g. TeamLease, Digivarsity)
 * Rendered in the contest nav and on the landing hero. Client-safe.
 */
export type LogoSlot = "org" | "parent";
export const LOGO_KEY: Record<LogoSlot, "orgLogo" | "parentLogo"> = { org: "orgLogo", parent: "parentLogo" };

export interface OrgLogo {
  url: string;
  /** Organisation name — alt text and the fallback label. */
  name: string;
}

/** Accepts absolute http(s) URLs and app-relative paths (e.g. /uploads/…). */
export function isLogoUrl(v: unknown): v is string {
  return typeof v === "string" && /^(https?:\/\/|\/(?!\/))/.test(v.trim()) && v.trim().length <= 500;
}

export function resolveLogo(branding: unknown, slot: LogoSlot): OrgLogo | null {
  const raw = (branding as Record<string, unknown> | null | undefined)?.[LOGO_KEY[slot]] as
    | { url?: unknown; name?: unknown }
    | undefined;
  if (!raw || !isLogoUrl(raw.url)) return null;
  return {
    url: raw.url.trim(),
    name: typeof raw.name === "string" ? raw.name.trim().slice(0, 120) : "",
  };
}

/** Display order of the two logos (brandingConfig.logoOrder). Default: parent first. */
export type LogoOrder = "parent-first" | "org-first";

export function resolveLogoOrder(branding: unknown): LogoOrder {
  const v = (branding as Record<string, unknown> | null | undefined)?.logoOrder;
  return v === "org-first" ? "org-first" : "parent-first";
}

/** The logos that are set, in display order. */
export function orderedLogos(
  parent: OrgLogo | null | undefined,
  org: OrgLogo | null | undefined,
  order: LogoOrder | undefined,
): Array<{ slot: LogoSlot; logo: OrgLogo }> {
  const list: Array<{ slot: LogoSlot; logo: OrgLogo | null | undefined }> =
    order === "org-first"
      ? [{ slot: "org", logo: org }, { slot: "parent", logo: parent }]
      : [{ slot: "parent", logo: parent }, { slot: "org", logo: org }];
  return list.filter((x): x is { slot: LogoSlot; logo: OrgLogo } => !!x.logo);
}

export const resolveOrgLogo = (branding: unknown) => resolveLogo(branding, "org");
export const resolveParentLogo = (branding: unknown) => resolveLogo(branding, "parent");
