/**
 * Impact-metric maths + formatting (Ideathon). Client-safe.
 *
 * Value to TLE = realised ₹ (during the live run) + recurring ₹/year × years.
 * Only Finance-validated values count toward totals.
 */
export type MetricStatus = "draft" | "submitted" | "validated" | "rejected";

export const METRIC_CATEGORIES = [
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
  { key: "time", label: "Time / TAT" },
  { key: "risk", label: "Risk" },
  { key: "adoption", label: "Adoption" },
  { key: "experience", label: "Experience" },
] as const;

export interface ImpactMetric {
  id: string;
  teamId: string;
  name: string;
  unit: string | null;
  direction: "increase" | "decrease" | string;
  category: string;
  sourceSystem: string | null;
  method: string | null;
  baselineValue: number | null;
  baselinePeriod: string | null;
  baselineEvidence: string[] | null;
  baselineStatus: MetricStatus | string;
  baselineNote: string | null;
  targetValue: number | null;
  actualValue: number | null;
  actualPeriod: string | null;
  actualEvidence: string[] | null;
  actualStatus: MetricStatus | string;
  actualNote: string | null;
  realisedValueInr: number | null;
  recurringAnnualValueInr: number | null;
  recurringYears: number | null;
  valuationBasis: string | null;
  financeStatus: "pending" | "validated" | "rejected" | string;
  financeNote: string | null;
}

/** Signed change in the "good" direction: positive = improvement. */
export function improvement(m: Pick<ImpactMetric, "baselineValue" | "actualValue" | "direction">): number | null {
  if (m.baselineValue === null || m.actualValue === null) return null;
  const d = m.actualValue - m.baselineValue;
  return m.direction === "decrease" ? -d : d;
}

/** % improvement vs baseline (positive = better), null when not computable. */
export function improvementPct(m: Pick<ImpactMetric, "baselineValue" | "actualValue" | "direction">): number | null {
  const imp = improvement(m);
  if (imp === null || !m.baselineValue) return null;
  return (imp / Math.abs(m.baselineValue)) * 100;
}

/** Total value to TLE for one metric (₹), counting only Finance-validated values. */
export function totalValueInr(m: Pick<ImpactMetric, "realisedValueInr" | "recurringAnnualValueInr" | "recurringYears" | "financeStatus">): number {
  if (m.financeStatus !== "validated") return 0;
  return (m.realisedValueInr ?? 0) + (m.recurringAnnualValueInr ?? 0) * Math.max(0, Math.min(3, m.recurringYears ?? 1));
}

/** ₹ in Indian style with L / Cr for big numbers: ₹4.2 L, ₹1.35 Cr. */
export function formatInr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

export function formatMetricValue(v: number | null | undefined, unit: string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const num = Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (!unit) return num;
  if (unit === "₹") return formatInr(v);
  if (unit === "%") return `${num}%`;
  return `${num} ${unit}`;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Waiting for Auditor",
  validated: "Validated",
  rejected: "Sent back",
  pending: "Waiting for Finance",
};
