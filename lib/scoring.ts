/**
 * Shared scoring maths (client-safe). One implementation for the leaderboard,
 * judge score tables, certificates/winners, live stage and judging UI.
 *
 * Every criterion score lives on the contest's scale (e.g. 0–100 or 1–10).
 * We normalise to 0–100 before weighting, so for the legacy 0–100 scale the
 * result is identical to the previous implementation.
 */
import { resolveScale, type ScoringScale } from "@/lib/contest-config";

export interface ScoringCriterion {
  name: string;
  key: string;
  weight: number;
  description?: string;
}

export interface PhaseEntry {
  phase: number;
  name: string;
  maxPoints: number;
}

export function normalizeToHundred(value: number, scale: ScoringScale): number {
  // Legacy 0–100 contests: use the raw value so totals stay bit-identical
  // to the pre-scale implementation.
  if (scale.min === 0 && scale.max === 100) return Math.min(100, Math.max(0, value));
  const span = scale.max - scale.min;
  if (span <= 0) return 0;
  const clamped = Math.min(scale.max, Math.max(scale.min, value));
  return ((clamped - scale.min) / span) * 100;
}

/** Weighted score on a 0–100 scale for one judge's criteria scores. */
export function calculateWeightedScore(
  criteriaScores: Record<string, number> | null | undefined,
  scoringCriteria: ScoringCriterion[],
  scaleRaw?: unknown,
): number {
  if (!criteriaScores || scoringCriteria.length === 0) return 0;
  const scale = resolveScale(scaleRaw);
  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of scoringCriteria) {
    const v = criteriaScores[c.key];
    if (v !== undefined && v !== null && !Number.isNaN(Number(v))) {
      weightedSum += normalizeToHundred(Number(v), scale) * c.weight;
      totalWeight += c.weight;
    }
  }
  if (totalWeight > 0 && totalWeight !== 1) return weightedSum / totalWeight;
  return weightedSum;
}

/** Average weighted score across judges (0–100). Returns null if unscored. */
export function averageWeighted(
  scoreRows: Array<{ criteriaScores: unknown }>,
  scoringCriteria: ScoringCriterion[],
  scaleRaw?: unknown,
): number | null {
  if (scoreRows.length === 0) return null;
  const sum = scoreRows.reduce(
    (acc, s) => acc + calculateWeightedScore(s.criteriaScores as Record<string, number> | null, scoringCriteria, scaleRaw),
    0,
  );
  return sum / scoreRows.length;
}

export function scorablePhases(phaseConfig: unknown): PhaseEntry[] {
  return ((Array.isArray(phaseConfig) ? phaseConfig : []) as PhaseEntry[]).filter((p) => (p.maxPoints ?? 0) > 0);
}

/**
 * Team total from its submissions: per phase keep the best averaged
 * submission, scale 0–100 → phase maxPoints, then sum.
 */
export function teamPhaseScores(
  teamSubmissions: Array<{ phase: number; scores: Array<{ criteriaScores: unknown }> }>,
  scoringCriteria: ScoringCriterion[],
  phaseConfig: unknown,
  scaleRaw?: unknown,
): { phaseScores: Record<string, number>; totalScore: number } {
  const phases = scorablePhases(phaseConfig);
  const best: Record<number, number> = {};
  for (const sub of teamSubmissions) {
    const avg = averageWeighted(sub.scores, scoringCriteria, scaleRaw);
    if (avg === null) continue;
    if (best[sub.phase] === undefined || avg > best[sub.phase]) best[sub.phase] = avg;
  }
  const phaseScores: Record<string, number> = {};
  let totalScore = 0;
  for (const p of phases) {
    const scaled = best[p.phase] ? (best[p.phase] / 100) * p.maxPoints : 0;
    phaseScores[`phase${p.phase}`] = scaled;
    totalScore += scaled;
  }
  return { phaseScores, totalScore };
}

/** Validate a criteria score map against the scale; returns an error string or null. */
export function validateCriteriaScores(
  criteriaScores: Record<string, unknown>,
  scaleRaw?: unknown,
): string | null {
  const scale = resolveScale(scaleRaw);
  for (const [key, value] of Object.entries(criteriaScores)) {
    if (typeof value !== "number" || Number.isNaN(value) || value < scale.min || value > scale.max) {
      return `Score for "${key}" must be a number between ${scale.min} and ${scale.max}`;
    }
  }
  return null;
}
