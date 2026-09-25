/**
 * Crew composition rules (Ideathon, but generic): required role coverage
 * (roleConfig[].minPerTeam, one person may cover several roles via
 * extra_roles), crew size (settings.minTeamMembers..maxTeamMembers) and
 * department mix (settings.minDepartmentsPerTeam).
 *
 * Client-safe: the dashboard renders the same checklist the submission API
 * enforces. Contests without these settings produce no issues.
 */
import { resolveSettings } from "@/lib/contest-config";
import { roleConfigOf, rolesOfMember } from "@/lib/team-capacity";

export interface CompositionMember {
  participantRole?: string | null;
  extraRoles?: unknown;
  department?: string | null;
}

export interface CompositionCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export function compositionChecks(
  contest: { roleConfig: unknown; settings: unknown; maxTeamMembers: number },
  members: CompositionMember[],
): CompositionCheck[] {
  const settings = resolveSettings(contest.settings);
  const checks: CompositionCheck[] = [];

  const min = settings.minTeamMembers ?? 0;
  if (min > 0) {
    const n = members.length;
    checks.push({
      key: "size",
      label: `${min}–${contest.maxTeamMembers} members`,
      ok: n >= min && n <= contest.maxTeamMembers,
      detail: `${n} now`,
    });
  }

  const minDepts = settings.minDepartmentsPerTeam ?? 0;
  if (minDepts > 1) {
    const depts = new Set(members.map((m) => (m.department ?? "").trim()).filter(Boolean));
    const missing = members.filter((m) => !(m.department ?? "").trim()).length;
    checks.push({
      key: "departments",
      label: `At least ${minDepts} departments`,
      ok: depts.size >= minDepts,
      detail: `${depts.size} so far${depts.size ? `: ${[...depts].join(", ")}` : ""}${missing ? ` · ${missing} member(s) have not set a department` : ""}`,
    });
  }

  for (const rc of roleConfigOf(contest.roleConfig)) {
    const need = rc.minPerTeam ?? 0;
    if (need <= 0) continue;
    const have = members.filter((m) => rolesOfMember(m).includes(rc.role)).length;
    checks.push({
      key: `role:${rc.role}`,
      label: need > 1 ? `${need}× ${rc.role}` : rc.role,
      ok: have >= need,
      detail: have ? `${have} covering` : "nobody yet",
    });
  }
  return checks;
}

/** First failing rule as a user-facing error, or null when the crew is complete. */
export function compositionError(
  contest: { roleConfig: unknown; settings: unknown; maxTeamMembers: number },
  members: CompositionMember[],
  teamWord = "team",
): string | null {
  const failing = compositionChecks(contest, members).filter((c) => !c.ok);
  if (failing.length === 0) return null;
  return `Your ${teamWord.toLowerCase()} is not complete yet: ${failing.map((c) => c.label).join(", ")}. See the checklist on your dashboard.`;
}
