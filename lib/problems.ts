/**
 * Problem Bank helpers (Ideathon). Server + client safe (no DB imports).
 */
export type ProblemStatus = "open" | "proposed" | "approved" | "rejected" | "closed";

export interface MetricTemplate {
  metric: string;
  unit: string;
  direction: "increase" | "decrease";
}

export interface ProblemRow {
  id: string;
  contestId: string;
  trackId: string | null;
  title: string;
  description: string | null;
  ownerDepartment: string | null;
  sponsor: string | null;
  metricTemplate: unknown;
  maxTeams: number;
  status: string;
  proposedByTeamId: string | null;
  sortOrder: number;
}

export interface ProblemWithClaims extends Omit<ProblemRow, "metricTemplate"> {
  metricTemplate: MetricTemplate | null;
  claimedBy: Array<{ id: string; name: string; status: string }>;
  slotsLeft: number;
  proposedByTeamName: string | null;
}

export function metricTemplateOf(raw: unknown): MetricTemplate | null {
  const m = raw as Partial<MetricTemplate> | null;
  if (!m || typeof m !== "object" || typeof m.metric !== "string" || !m.metric.trim()) return null;
  return {
    metric: m.metric.trim().slice(0, 120),
    unit: typeof m.unit === "string" ? m.unit.trim().slice(0, 30) : "",
    direction: m.direction === "increase" ? "increase" : "decrease",
  };
}

export function problemWithClaims(
  p: ProblemRow,
  teams: Array<{ id: string; name: string; problemId: string | null; status: string }>,
): ProblemWithClaims {
  const claimedBy = teams.filter((t) => t.problemId === p.id).map((t) => ({ id: t.id, name: t.name, status: t.status }));
  const active = claimedBy.filter((t) => t.status !== "eliminated" && t.status !== "withdrawn").length;
  return {
    ...p,
    metricTemplate: metricTemplateOf(p.metricTemplate),
    claimedBy,
    slotsLeft: Math.max(0, p.maxTeams - active),
    proposedByTeamName: p.proposedByTeamId ? teams.find((t) => t.id === p.proposedByTeamId)?.name ?? null : null,
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function parseProblemInput(body: unknown):
  | { value: {
      title: string;
      description: string | null;
      trackId: string | null;
      ownerDepartment: string | null;
      sponsor: string | null;
      metricTemplate: MetricTemplate | null;
      maxTeams: number;
    } }
  | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const title = str(b.title, 255);
  if (!title) return { error: "A problem needs a title" };
  const maxTeamsRaw = Number(b.maxTeams ?? 1);
  return {
    value: {
      title,
      description: str(b.description, 5000),
      trackId: str(b.trackId, 64),
      ownerDepartment: str(b.ownerDepartment, 255),
      sponsor: str(b.sponsor, 255),
      metricTemplate: metricTemplateOf(b.metricTemplate),
      maxTeams: Number.isInteger(maxTeamsRaw) ? Math.min(20, Math.max(1, maxTeamsRaw)) : 1,
    },
  };
}
