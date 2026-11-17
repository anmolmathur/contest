/**
 * Generic submission fields. Client-safe (no DB imports).
 *
 * A contest's `submissionFields` defines what teams hand in per phase/round.
 * Values are stored in `submissions.fields` (jsonb). Hackathon contests keep
 * mirroring into the legacy columns (github_url, demo_url, ai_*), see
 * `legacyColumnsFrom`.
 */
import type { AgentCharterEntry, SubmissionField, SubmissionValues } from "@/lib/contest-config";

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

/** Is this field required for a team that declared `paths` (Ideathon solution paths)? */
export function isFieldRequired(f: SubmissionField, paths?: string[] | null): boolean {
  if (f.required) return true;
  if (f.requiredForPaths?.length && paths?.length) return f.requiredForPaths.some((p) => paths.includes(p));
  return false;
}

const CHARTER_KEYS: Array<keyof AgentCharterEntry> = [
  "name",
  "platform",
  "task",
  "autonomy",
  "humanCheckpoint",
  "dataAccessed",
  "guardrails",
];

/** Parse a stored Agent Charter (JSON string or array) into clean entries. */
export function parseAgentCharter(v: unknown): AgentCharterEntry[] {
  let raw: unknown = v;
  if (typeof v === "string") {
    try {
      raw = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const o = r as Record<string, unknown>;
      const e = {} as AgentCharterEntry;
      for (const k of CHARTER_KEYS) (e as unknown as Record<string, string>)[k] = String(o[k] ?? "").trim().slice(0, 2000);
      const cost = Number(o.monthlyCostInr);
      e.monthlyCostInr = Number.isFinite(cost) && o.monthlyCostInr !== "" && o.monthlyCostInr != null ? cost : null;
      return e;
    })
    .filter((e) => e.name || e.task);
}

/** Human-readable text for any stored value (charters become one line per agent). */
export function displayValue(field: SubmissionField | undefined, v: string | string[] | undefined): string {
  if (v === undefined) return "";
  if (field?.type === "agentCharter") {
    return parseAgentCharter(v)
      .map((a) => `${a.name} [${a.autonomy || "?"}] on ${a.platform || "?"}: ${a.task}${a.humanCheckpoint ? ` (human check: ${a.humanCheckpoint})` : ""}`)
      .join("\n");
  }
  return Array.isArray(v) ? v.join(", ") : v;
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
  solutionPaths?: string[] | null,
): { values: SubmissionValues; error?: undefined } | { error: string; values?: undefined } {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const values: SubmissionValues = {};
  // Paths declared in this very submission win over the team's stored ones.
  const declared = input["solutionPaths"];
  const paths = Array.isArray(declared) ? declared.map(String) : solutionPaths ?? null;
  for (const f of fieldsForPhase(fields, phase)) {
    const v = input[f.key];
    const required = isFieldRequired(f, paths);
    if (f.type === "multiselect") {
      const arr = (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(/\n|,/) : [])
        .map((x) => String(x).trim())
        .filter(Boolean);
      if (required && arr.length === 0) return { error: `"${f.label}" is required` };
      const bad = f.options?.length ? arr.find((x) => !f.options!.includes(x)) : undefined;
      if (bad) return { error: `"${f.label}" must be from: ${f.options!.join(", ")}` };
      if (arr.length) values[f.key] = Array.from(new Set(arr));
      continue;
    }
    if (f.type === "agentCharter") {
      const entries = parseAgentCharter(v);
      if (required && entries.length === 0) return { error: `"${f.label}" needs at least one agent` };
      const incomplete = entries.find((e) => !e.name || !e.task || !e.autonomy);
      if (incomplete) return { error: `Every agent in "${f.label}" needs a name, a task and an autonomy level` };
      if (entries.length) values[f.key] = JSON.stringify(entries);
      continue;
    }
    if (f.type === "number") {
      const s = v === null || v === undefined ? "" : String(v).trim();
      if (required && !s) return { error: `"${f.label}" is required` };
      if (!s) continue;
      const n = Number(s);
      if (!Number.isFinite(n)) return { error: `"${f.label}" must be a number` };
      if (f.min !== undefined && n < f.min) return { error: `"${f.label}" must be at least ${f.min}` };
      if (f.max !== undefined && n > f.max) return { error: `"${f.label}" must be at most ${f.max}` };
      values[f.key] = String(n);
      continue;
    }
    if (isMultiValue(f)) {
      const arr = (Array.isArray(v) ? v : typeof v === "string" ? v.split(/\n|,/) : [])
        .map((x) => String(x).trim())
        .filter(Boolean);
      if (required && arr.length === 0) return { error: `"${f.label}" is required` };
      const bad = arr.find((x) => !looksLikeUrl(x));
      if (bad) return { error: `"${f.label}" contains an invalid link: ${bad.slice(0, 80)}` };
      if (arr.length) values[f.key] = arr;
      continue;
    }
    const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
    if (required && !s) return { error: `"${f.label}" is required` };
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
export function submissionHeadline(fields: SubmissionField[], values: SubmissionValues, maxLength = 240): string {
  for (const f of fields) {
    if (f.type === "textarea" || f.type === "text") {
      const v = values[f.key];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, maxLength);
    }
  }
  return "";
}

export { isNonEmpty };
