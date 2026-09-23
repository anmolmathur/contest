/**
 * Form model for the generic-engine part of the contest admin Settings tab
 * (type, submission fields, scale, vocabulary, flags, agenda, speakers, FAQ,
 * extra landing/rules fields). Initialised with preset / resolve* fallbacks so
 * legacy contests whose jsonb columns are null still get a sensible form, and
 * serialised into the PUT /api/contests/[slug] payload.
 */
import {
  isContestType,
  resolveScale,
  resolveSettings,
  type AgendaItem,
  type ContestSettings,
  type ContestType,
  type ScoringScale,
  type Speaker,
  type SubmissionField,
  type Terminology,
} from "@/lib/contest-config";
import { resolveSubmissionFields } from "@/lib/submission-fields";
import { getPreset } from "@/lib/contest-types";

export type Visibility = "public" | "unlisted" | "private";

/** Known settings plus any extra keys already stored (e.g. allowedEmailDomains) so saves never drop them. */
export type SettingsForm = ContestSettings & Record<string, unknown>;

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface ExtendedConfigForm {
  contestType: ContestType;
  submissionFields: SubmissionField[];
  scoringScale: ScoringScale;
  terminology: Terminology;
  settings: SettingsForm;
  visibility: Visibility;
  supportEmail: string;
  agenda: AgendaItem[];
  speakers: Speaker[];
  faqConfig: FaqEntry[];
  heroCtaText: string;
  bannerImageUrl: string;
  eligibilityRules: string;
  teamStructureRules: string;
  deliverableRules: string;
  /** yyyy-mm-ddThh:mm (datetime-local) or "" */
  startDate: string;
  endDate: string;
}

/** Loose shape — accepts the client context contest or the raw GET /api/contests/[slug] row. */
export interface ContestLike {
  contestType?: string | null;
  submissionFields?: unknown;
  scoringScale?: unknown;
  terminology?: unknown;
  settings?: unknown;
  visibility?: string | null;
  supportEmail?: string | null;
  agenda?: unknown;
  speakers?: unknown;
  faqConfig?: unknown;
  heroCtaText?: string | null;
  bannerImageUrl?: string | null;
  eligibilityRules?: string | null;
  teamStructureRules?: string | null;
  deliverableRules?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

/** ISO/Date -> value for <input type="datetime-local"> in the viewer's local time. */
export function toLocalInput(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function mergeSettings(raw: unknown): SettingsForm {
  const extra = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { ...extra, ...resolveSettings(raw) };
}

export function initExtendedConfig(c: ContestLike): ExtendedConfigForm {
  const type: ContestType = isContestType(c.contestType) ? c.contestType : "hackathon";
  const preset = getPreset(type);
  const vis = c.visibility;
  return {
    contestType: type,
    submissionFields: resolveSubmissionFields(c.submissionFields).map((f) => ({ ...f })),
    scoringScale: resolveScale(c.scoringScale),
    terminology: { ...((c.terminology as Terminology | null) ?? preset.terminology) },
    settings: mergeSettings(c.settings),
    visibility: vis === "unlisted" || vis === "private" ? vis : "public",
    supportEmail: c.supportEmail ?? "",
    agenda: arr<AgendaItem>(c.agenda),
    speakers: arr<Speaker>(c.speakers).map((s) => ({ ...s, roles: Array.isArray(s.roles) ? s.roles : [] })),
    faqConfig: arr<FaqEntry>(c.faqConfig),
    heroCtaText: c.heroCtaText ?? "",
    bannerImageUrl: c.bannerImageUrl ?? "",
    eligibilityRules: c.eligibilityRules ?? "",
    teamStructureRules: c.teamStructureRules ?? "",
    deliverableRules: c.deliverableRules ?? "",
    startDate: toLocalInput(c.startDate),
    endDate: toLocalInput(c.endDate),
  };
}

/** Validation errors that should block a save (empty array = OK). */
export function validateExtendedConfig(f: ExtendedConfigForm): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  f.submissionFields.forEach((field, i) => {
    const label = field.label || `#${i + 1}`;
    if (!field.key.trim()) errors.push(`Submission field ${label} needs a key`);
    else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key)) errors.push(`Submission field key "${field.key}" must start with a letter and use only letters, digits or _`);
    else if (keys.has(field.key)) errors.push(`Duplicate submission field key "${field.key}"`);
    keys.add(field.key);
    if (!field.label.trim()) errors.push(`Submission field #${i + 1} needs a label`);
    if (field.type === "select" && !(field.options ?? []).some((o) => o.trim())) {
      errors.push(`Select field ${label} needs at least one option`);
    }
  });
  const s = f.scoringScale;
  if (!(s.max > s.min)) errors.push("Scoring scale: max must be greater than min");
  if (!(s.step > 0)) errors.push("Scoring scale: step must be positive");
  f.agenda.forEach((a, i) => {
    if (!a.title.trim()) errors.push(`Agenda item #${i + 1} needs a title`);
  });
  f.speakers.forEach((sp, i) => {
    if (!sp.name.trim()) errors.push(`Speaker #${i + 1} needs a name`);
  });
  if (f.supportEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.supportEmail.trim())) {
    errors.push("Support email is not a valid address");
  }
  return errors;
}

/** Serialise into PUT /api/contests/[slug] fields. */
export function extendedPayload(f: ExtendedConfigForm): Record<string, unknown> {
  const clean = (s: string) => (s.trim() ? s.trim() : null);
  const settings: SettingsForm = { ...f.settings };
  if (typeof settings.theme === "string" && !settings.theme.trim()) delete settings.theme;
  if (settings.colorMode !== "light" && settings.colorMode !== "dark") delete settings.colorMode;
  return {
    contestType: f.contestType,
    submissionFields: f.submissionFields.map((field) => {
      const out: SubmissionField = {
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: !!field.required,
      };
      if (field.placeholder?.trim()) out.placeholder = field.placeholder.trim();
      if (field.helpText?.trim()) out.helpText = field.helpText.trim();
      if (field.phases && field.phases.length > 0) out.phases = [...field.phases].sort((a, b) => a - b);
      if ((field.type === "file" || field.type === "fileList") && field.accept?.trim()) out.accept = field.accept.trim();
      if ((field.type === "file" || field.type === "fileList") && field.maxSizeMb) out.maxSizeMb = field.maxSizeMb;
      if (field.type === "select") out.options = (field.options ?? []).map((o) => o.trim()).filter(Boolean);
      return out;
    }),
    scoringScale: {
      min: f.scoringScale.min,
      max: f.scoringScale.max,
      step: f.scoringScale.step,
      ...(f.scoringScale.labels && f.scoringScale.labels.length > 0
        ? { labels: f.scoringScale.labels.filter((l) => l.label.trim()) }
        : {}),
    },
    // Blank entries fall back to the type's vocabulary (what the editor shows as placeholders).
    terminology: {
      ...getPreset(f.contestType).terminology,
      ...Object.fromEntries(
        Object.entries(f.terminology)
          .filter(([, v]) => typeof v === "string" && v.trim())
          .map(([k, v]) => [k, (v as string).trim()]),
      ),
    },
    settings,
    visibility: f.visibility,
    supportEmail: clean(f.supportEmail),
    agenda: [...f.agenda].sort((a, b) => `${a.day} ${a.start}`.localeCompare(`${b.day} ${b.start}`)),
    speakers: f.speakers,
    faqConfig: f.faqConfig.filter((q) => q.question.trim() || q.answer.trim()),
    heroCtaText: clean(f.heroCtaText),
    bannerImageUrl: clean(f.bannerImageUrl),
    eligibilityRules: clean(f.eligibilityRules),
    teamStructureRules: clean(f.teamStructureRules),
    deliverableRules: clean(f.deliverableRules),
    startDate: f.startDate ? new Date(f.startDate).toISOString() : null,
    endDate: f.endDate ? new Date(f.endDate).toISOString() : null,
  };
}

/**
 * Merge an AI-assistant patch (partial ContestDraft) into the extended form.
 * Returns the new form and the list of keys it consumed.
 */
export function mergeExtendedPatch(
  f: ExtendedConfigForm,
  patch: Record<string, unknown>,
): { form: ExtendedConfigForm; applied: string[] } {
  const next: ExtendedConfigForm = { ...f };
  const applied: string[] = [];
  const has = (k: string) => patch[k] !== undefined && patch[k] !== null;
  if (has("contestType") && isContestType(patch.contestType)) {
    next.contestType = patch.contestType;
    applied.push("contestType");
  }
  if (has("submissionFields") && Array.isArray(patch.submissionFields)) {
    next.submissionFields = patch.submissionFields as SubmissionField[];
    applied.push("submissionFields");
  }
  if (has("scoringScale")) {
    next.scoringScale = resolveScale(patch.scoringScale);
    applied.push("scoringScale");
  }
  if (has("terminology") && typeof patch.terminology === "object") {
    next.terminology = { ...next.terminology, ...(patch.terminology as Terminology) };
    applied.push("terminology");
  }
  if (has("settings") && typeof patch.settings === "object") {
    next.settings = { ...next.settings, ...(patch.settings as SettingsForm) };
    applied.push("settings");
  }
  if (has("visibility") && ["public", "unlisted", "private"].includes(patch.visibility as string)) {
    next.visibility = patch.visibility as Visibility;
    applied.push("visibility");
  }
  if (has("agenda") && Array.isArray(patch.agenda)) {
    next.agenda = patch.agenda as AgendaItem[];
    applied.push("agenda");
  }
  if (has("speakers") && Array.isArray(patch.speakers)) {
    next.speakers = (patch.speakers as Speaker[]).map((s) => ({ ...s, roles: Array.isArray(s.roles) ? s.roles : [] }));
    applied.push("speakers");
  }
  if (has("faqConfig") && Array.isArray(patch.faqConfig)) {
    next.faqConfig = patch.faqConfig as FaqEntry[];
    applied.push("faqConfig");
  }
  for (const k of [
    "supportEmail",
    "heroCtaText",
    "bannerImageUrl",
    "eligibilityRules",
    "teamStructureRules",
    "deliverableRules",
  ] as const) {
    if (typeof patch[k] === "string") {
      next[k] = patch[k] as string;
      applied.push(k);
    }
  }
  for (const k of ["startDate", "endDate"] as const) {
    if (typeof patch[k] === "string") {
      next[k] = toLocalInput(patch[k] as string);
      applied.push(k);
    }
  }
  return { form: next, applied };
}
