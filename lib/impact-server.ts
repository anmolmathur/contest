/**
 * Input parsing for impact metrics (server routes). Keeps field rules in one place.
 */
import type { impactMetrics } from "@/lib/db/schema";

type MetricPatch = Partial<typeof impactMetrics.$inferInsert>;

const CATEGORIES = ["revenue", "cost", "time", "risk", "adoption", "experience"];

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function num(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : "invalid";
}

function urls(v: unknown): string[] | null | "invalid" {
  if (v === null || v === undefined) return null;
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\n|,/) : [];
  const clean = arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 10);
  if (clean.some((u) => !/^https?:\/\/\S+$/i.test(u) && !u.startsWith("/uploads/") && !u.startsWith("/api/uploads/"))) return "invalid";
  return clean;
}

/** Parse team-editable metric fields. `create` requires a name. */
export function parseMetricInput(body: unknown, create: boolean): { value: MetricPatch } | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: MetricPatch = {};
  if (b.name !== undefined || create) {
    const name = text(b.name, 255);
    if (!name) return { error: "A metric needs a name" };
    out.name = name;
  }
  if (b.unit !== undefined) out.unit = text(b.unit, 50);
  if (b.direction !== undefined) {
    if (b.direction !== "increase" && b.direction !== "decrease") return { error: "direction must be increase or decrease" };
    out.direction = b.direction;
  }
  if (b.category !== undefined) {
    if (typeof b.category !== "string" || !CATEGORIES.includes(b.category)) return { error: `category must be one of ${CATEGORIES.join(", ")}` };
    out.category = b.category;
  }
  if (b.sourceSystem !== undefined) out.sourceSystem = text(b.sourceSystem, 255);
  if (b.method !== undefined) out.method = text(b.method, 4000);
  for (const k of ["baselineValue", "targetValue", "actualValue"] as const) {
    if (b[k] !== undefined) {
      const n = num(b[k]);
      if (n === "invalid") return { error: `${k} must be a number` };
      out[k] = n;
    }
  }
  if (b.baselinePeriod !== undefined) out.baselinePeriod = text(b.baselinePeriod, 120);
  if (b.actualPeriod !== undefined) out.actualPeriod = text(b.actualPeriod, 120);
  for (const k of ["baselineEvidence", "actualEvidence"] as const) {
    if (b[k] !== undefined) {
      const u = urls(b[k]);
      if (u === "invalid") return { error: "Evidence must be links (https://…) or uploaded files" };
      out[k] = u;
    }
  }
  return { value: out };
}
