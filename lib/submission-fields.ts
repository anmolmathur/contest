/**
 * Generic submission fields. Client-safe (no DB imports).
 *
 * A contest's `submissionFields` defines what teams hand in per phase/round.
 * Values are stored in `submissions.fields` (jsonb). Hackathon contests keep
 * mirroring into the legacy columns (github_url, demo_url, ai_*), see
 * `legacyColumnsFrom`.
 */
import type { SubmissionField, SubmissionValues } from "@/lib/contest-config";

/** Legacy hackathon field set — used when a contest has no submissionFields configured. */
export const LEGACY_HACKATHON_FIELDS: SubmissionField[] = [
  { key: "githubUrl", label: "GitHub Repository", type: "url", required: true, placeholder: "https://github.com/..." },
  { key: "demoUrl", label: "Live Demo URL", type: "url", required: true, placeholder: "https://..." },
  {
    key: "submissionDescription",
    label: "Submission Description",
    type: "textarea",
    required: true,
    placeholder: "Describe what you built. Include a Google Drive link for complete documentation.",
  },
  { key: "aiPromptsUsed", label: "AI Prompts Used", type: "textarea", required: true, placeholder: "Key prompts you used and what they produced" },
  {
    key: "aiToolsUtilized",
    label: "AI Tools Utilized",
    type: "textarea",
    required: true,
    placeholder: "List all AI tools (ChatGPT, Copilot, Claude, etc.)",
  },
  {
    key: "aiScreenshots",
    label: "AI Usage Screenshots",
    type: "fileList",
    required: true,
    accept: ".png,.jpg,.jpeg,.webp,.gif",
    maxSizeMb: 10,
    helpText: "Upload screenshots showing AI usage (or paste image links).",
  },
];

const LEGACY_KEYS = ["githubUrl", "demoUrl", "submissionDescription", "aiPromptsUsed", "aiToolsUtilized", "aiScreenshots"] as const;

export function resolveSubmissionFields(raw: unknown): SubmissionField[] {
  if (Array.isArray(raw) && raw.length > 0) return raw as SubmissionField[];
  return LEGACY_HACKATHON_FIELDS;
}

/** Fields that apply to a given phase (empty `phases` = applies to every phase). */
export function fieldsForPhase(fields: SubmissionField[], phase: number): SubmissionField[] {
  return fields.filter((f) => !f.phases || f.phases.length === 0 || f.phases.includes(phase));
}

export function isMultiValue(f: SubmissionField): boolean {
  return f.type === "urlList" || f.type === "fileList";
}

function isNonEmpty(v: unknown): boolean {
  if (Array.isArray(v)) return v.some((x) => typeof x === "string" && x.trim() !== "");
  return typeof v === "string" && v.trim() !== "";
}

function looksLikeUrl(s: string): boolean {
  // Accept absolute http(s) URLs and our own relative upload URLs.
  return /^https?:\/\/\S+$/i.test(s) || s.startsWith("/uploads/") || s.startsWith("/api/uploads/");
}

/**
 * Validate + normalise submitted values for a phase. Unknown keys are dropped.
 * Returns `{ values }` on success or `{ error }` with a user-facing message.
 */
export function validateSubmission(
  fields: SubmissionField[],
  raw: unknown,
  phase: number,
): { values: SubmissionValues; error?: undefined } | { error: string; values?: undefined } {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const values: SubmissionValues = {};
  for (const f of fieldsForPhase(fields, phase)) {
    const v = input[f.key];
    if (isMultiValue(f)) {
      const arr = (Array.isArray(v) ? v : typeof v === "string" ? v.split(/\n|,/) : [])
        .map((x) => String(x).trim())
        .filter(Boolean);
      if (f.required && arr.length === 0) return { error: `"${f.label}" is required` };
      const bad = arr.find((x) => !looksLikeUrl(x));
      if (bad) return { error: `"${f.label}" contains an invalid link: ${bad.slice(0, 80)}` };
      if (arr.length) values[f.key] = arr;
      continue;
    }
    const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
    if (f.required && !s) return { error: `"${f.label}" is required` };
    if (!s) continue;
    if ((f.type === "url" || f.type === "file") && !looksLikeUrl(s)) {
      return { error: `"${f.label}" must be a valid link (https://...)` };
    }
    if (f.type === "select" && f.options?.length && !f.options.includes(s)) {
      return { error: `"${f.label}" must be one of: ${f.options.join(", ")}` };
    }
    if (s.length > 20000) return { error: `"${f.label}" is too long` };
    values[f.key] = s;
  }
  return { values };
}

/** Read a value, preferring `fields` jsonb, falling back to the legacy column. */
export function getSubmissionValue(
  sub: { fields?: unknown } & Record<string, unknown>,
  key: string,
): string | string[] | undefined {
  const f = (sub.fields ?? null) as SubmissionValues | null;
  if (f && f[key] !== undefined && f[key] !== null) return f[key];
  const legacy = sub[key];
  if (legacy === null || legacy === undefined) return undefined;
  if (Array.isArray(legacy)) return legacy.map(String);
  return String(legacy);
}

/** All values of a submission as a plain map (fields + legacy fallback). */
export function submissionValues(sub: { fields?: unknown } & Record<string, unknown>): SubmissionValues {
  const out: SubmissionValues = {};
  for (const k of LEGACY_KEYS) {
    const v = getSubmissionValue(sub, k);
    if (v !== undefined && v !== "") out[k] = v;
  }
  const f = (sub.fields ?? null) as SubmissionValues | null;
  if (f) Object.assign(out, f);
  return out;
}

/** Mirror generic values into legacy hackathon columns (nulls where absent). */
export function legacyColumnsFrom(values: SubmissionValues) {
  const str = (k: string) => {
    const v = values[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v.join("\n") : null;
  };
  const shots = values["aiScreenshots"];
  return {
    githubUrl: str("githubUrl")?.slice(0, 255) ?? null,
    demoUrl: str("demoUrl")?.slice(0, 255) ?? null,
    submissionDescription: str("submissionDescription") ?? str("executiveSummary") ?? null,
    aiPromptsUsed: str("aiPromptsUsed"),
    aiToolsUtilized: str("aiToolsUtilized"),
    aiScreenshots: Array.isArray(shots) ? shots : typeof shots === "string" ? [shots] : null,
  };
}

/** Short one-line summary of a submission, for lists/cards. */
export function submissionHeadline(fields: SubmissionField[], values: SubmissionValues): string {
  for (const f of fields) {
    if (f.type === "textarea" || f.type === "text") {
      const v = values[f.key];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, 240);
    }
  }
  return "";
}

export { isNonEmpty };
