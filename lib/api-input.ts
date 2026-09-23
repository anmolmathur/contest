/**
 * Small request-parsing helpers shared by the contest API routes
 * (submissions, scores, teams). Client-safe: no DB imports.
 */
import { term, type TermKey, type Terminology } from "@/lib/contest-config";
import { getPreset } from "@/lib/contest-types";

/**
 * Submission payloads come in two shapes:
 *   new:    { phase, fields: { key: value } }
 *   legacy: { phase, githubUrl, demoUrl, ... }   (flat keys)
 * Returns the raw field map either way (unknown keys are dropped later by
 * `validateSubmission`).
 */
export function extractSubmissionInput(body: unknown): Record<string, unknown> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (b.fields && typeof b.fields === "object" && !Array.isArray(b.fields)) {
    return b.fields as Record<string, unknown>;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { phase, fields, submissionId, ...rest } = b;
  return rest;
}

/** Parse a phase number from a JSON body value (number or numeric string). */
export function parsePhase(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

/** Hackathon contests (or contests without configured fields) keep mirroring into legacy columns. */
export function usesLegacySubmissionColumns(contest: { contestType?: string | null; submissionFields?: unknown }): boolean {
  return (
    !contest.contestType ||
    contest.contestType === "hackathon" ||
    !Array.isArray(contest.submissionFields) ||
    contest.submissionFields.length === 0
  );
}

/**
 * Optional free-text body value.
 *  - undefined  → `{ value: undefined }` (field not sent; leave DB value alone)
 *  - null / ""  → `{ value: null }`      (clear it)
 *  - string     → trimmed; error if longer than `max`
 */
export function parseOptionalText(
  v: unknown,
  label: string,
  max = 5000,
): { value: string | null | undefined; error?: undefined } | { error: string; value?: undefined } {
  if (v === undefined) return { value: undefined };
  if (v === null) return { value: null };
  if (typeof v !== "string") return { error: `${label} must be text` };
  const s = v.trim();
  if (s.length > max) return { error: `${label} is too long (max ${max} characters)` };
  return { value: s === "" ? null : s };
}

/** Contest vocabulary with the preset fallback (same resolution as useContestConfig()). */
export function contestTerminology(contest: { terminology?: unknown; contestType?: string | null }): Terminology {
  return (contest.terminology as Terminology | null) ?? getPreset(contest.contestType).terminology;
}

export function contestTerm(contest: { terminology?: unknown; contestType?: string | null }, key: TermKey): string {
  return term(contestTerminology(contest), key);
}
