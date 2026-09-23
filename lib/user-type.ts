/**
 * Internal vs external users.
 *
 * Anyone whose email is on a TeamLease domain is an internal employee;
 * everyone else (students on Gmail, college domains, partners) is external.
 * Domains are configurable via INTERNAL_EMAIL_DOMAINS (comma-separated).
 */
const DEFAULT_INTERNAL_DOMAINS = ["teamlease.com", "teamleaseedtech.com"];

export type UserType = "internal" | "external";

export function internalDomains(): string[] {
  const env = process.env.INTERNAL_EMAIL_DOMAINS;
  const list = env ? env.split(",") : DEFAULT_INTERNAL_DOMAINS;
  return list.map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export function emailDomain(email: string): string {
  return email.split("@")[1]?.trim().toLowerCase() ?? "";
}

export function userTypeForEmail(email: string): UserType {
  const domain = emailDomain(email);
  return internalDomains().some((d) => domain === d || domain.endsWith(`.${d}`)) ? "internal" : "external";
}
