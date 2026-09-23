/**
 * ContestDraft — the shape the AI setup assistant proposes, plus the
 * server-side sanitiser that turns untrusted model JSON into a valid draft.
 *
 * Client-safe (no DB / OpenAI imports): the admin UI imports the types, the
 * /api/ai/contest-setup route runs `sanitizeDraft` on every model response.
 *
 * Keys deliberately mirror the POST /api/contests body (create) and the
 * PUT /api/contests/[slug] body (edit) so a draft can be spread straight into
 * those payloads. `tracks` is only consumed by POST (edit mode: apply via the
 * tracks editor). The assistant never sets execution state (status,
 * resultsPublished, liveState, teams, scores).
 */
import {
  AGENDA_KIND_LABELS,
  isContestType,
  type AgendaItem,
  type AgendaKind,
  type ContestSettings,
  type ContestType,
  type ScoringScale,
  type Speaker,
  type SpeakerRole,
  type SubmissionField,
  type SubmissionFieldType,
  type TermKey,
  type Terminology,
} from "@/lib/contest-config";
import { getPreset } from "@/lib/contest-types";

export interface DraftTrack {
  name: string;
  description: string;
  icon?: string;
}

export interface DraftPhase {
  phase: number;
  name: string;
  maxPoints: number;
  /** yyyy-mm-dd or "" */
  startDate: string;
  endDate: string;
  description: string;
  /** Activities */
  details: string[];
  deliverables: string[];
}

export interface DraftCriterion {
  name: string;
  key: string;
  /** 0..1, all weights sum to 1.0 */
  weight: number;
  description: string;
}

export interface DraftPrize {
  rank: number;
  label: string;
  amount: number | null;
  color: string;
}

export interface DraftRole {
  role: string;
  maxPerTeam: number;
}

export interface DraftFaq {
  question: string;
  answer: string;
}

/** Settings the setup assistant may touch (never resultsPublished). */
export type DraftSettings = Pick<
  ContestSettings,
  "theme" | "exclusiveTracks" | "showcaseEnabled" | "feedbackVisibility" | "assistantEnabled"
> &
  Record<string, unknown>;

export interface ContestDraftShape {
  contestType?: ContestType;
  name?: string;
  slug?: string;
  description?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroCtaText?: string;
  rulesContent?: string;
  eligibilityRules?: string;
  teamStructureRules?: string;
  deliverableRules?: string;
  /** yyyy-mm-dd */
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  maxTeams?: number;
  maxApprovedTeams?: number;
  maxTeamMembers?: number;
  supportEmail?: string;
  /** Categories / tracks (POST /api/contests only). */
  tracks?: DraftTrack[];
  /** Rounds / phases, numbered from 1. */
  phaseConfig?: DraftPhase[];
  scoringCriteria?: DraftCriterion[];
  scoringScale?: ScoringScale;
  submissionFields?: SubmissionField[];
  terminology?: Terminology;
  roleConfig?: DraftRole[];
  prizes?: DraftPrize[];
  faqConfig?: DraftFaq[];
  agenda?: AgendaItem[];
  speakers?: Speaker[];
  settings?: DraftSettings;
}

/**
 * Index signature kept for backwards compatibility with the original stub
 * contract (`[key: string]: unknown`), so callers can still read any key.
 */
export type ContestDraft = ContestDraftShape & { [key: string]: unknown };

export const DRAFT_KEYS: (keyof ContestDraftShape)[] = [
  "contestType",
  "name",
  "slug",
  "description",
  "heroTitle",
  "heroSubtitle",
  "heroCtaText",
  "rulesContent",
  "eligibilityRules",
  "teamStructureRules",
  "deliverableRules",
  "startDate",
  "endDate",
  "registrationDeadline",
  "maxTeams",
  "maxApprovedTeams",
  "maxTeamMembers",
  "supportEmail",
  "tracks",
  "phaseConfig",
  "scoringCriteria",
  "scoringScale",
  "submissionFields",
  "terminology",
  "roleConfig",
  "prizes",
  "faqConfig",
  "agenda",
  "speakers",
  "settings",
];

export const FIELD_TYPES: SubmissionFieldType[] = ["text", "textarea", "url", "urlList", "file", "fileList", "select"];
const TERM_KEYS: TermKey[] = ["track", "team", "phase", "judge", "submission", "member", "contest"];
const SPEAKER_ROLES: SpeakerRole[] = ["speaker", "panelist", "jury", "mentor", "host"];
const AGENDA_KINDS = Object.keys(AGENDA_KIND_LABELS) as AgendaKind[];

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Primitive coercion helpers
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

export function str(v: unknown, max: number): string | undefined {
  if (typeof v === "number" || typeof v === "boolean") v = String(v);
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\u0000/g, "").trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max).trimEnd() : s;
}

function int(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\n|;/) : [];
  return arr
    .map((x) => str(x, maxLen))
    .filter((x): x is string => !!x)
    .slice(0, maxItems);
}

/** Any recognisable date → yyyy-mm-dd (UTC date part), else undefined. */
export function isoDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const s = v.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]) {
      return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return undefined;
  }
  // Non-ISO strings ("7 Nov 2026") parse as local time — read local date parts.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function camelKey(s: string): string {
  const words = s
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const out = words
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
  const k = /^[a-zA-Z]/.test(out) ? out : `f${out}`;
  return k.slice(0, 40);
}

function uniqueKey(base: string, used: Set<string>): string {
  let k = base || "field";
  let i = 2;
  while (used.has(k)) k = `${base}${i++}`;
  used.add(k);
  return k;
}

function shortId(prefix: string, i: number, seed: string): string {
  const h = Array.from(seed).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `${prefix}-${i + 1}-${h.toString(36).slice(0, 6)}`;
}

// ---------------------------------------------------------------------------
// Section sanitisers
// ---------------------------------------------------------------------------

function sanitizeTracks(v: unknown): DraftTrack[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: DraftTrack[] = [];
  for (const raw of v) {
    const t: Obj = isObj(raw) ? raw : { name: raw };
    const name = str(t.name ?? t.title, 120);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const icon = str(t.icon, 40);
    out.push({
      name,
      description: str(t.description, 600) ?? "",
      ...(icon && /^[A-Za-z0-9]+$/.test(icon) ? { icon } : {}),
    });
    if (out.length >= 30) break;
  }
  return out;
}

function sanitizePhases(v: unknown): DraftPhase[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const items = v
    .filter(isObj)
    .map((p, i) => ({ p, order: num(p.phase) ?? i + 1 }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 10);
  return items.map(({ p }, i) => ({
    phase: i + 1,
    name: str(p.name, 120) ?? `Round ${i + 1}`,
    maxPoints: int(p.maxPoints ?? p.points, 0, 1000) ?? 0,
    startDate: isoDate(p.startDate) ?? "",
    endDate: isoDate(p.endDate) ?? "",
    description: str(p.description, 800) ?? "",
    details: strList(p.details ?? p.activities, 12, 300),
    deliverables: strList(p.deliverables, 12, 300),
  }));
}

/** Normalise weights so they sum to exactly 1.00 (2-decimal precision). */
export function normalizeWeights(weights: number[]): number[] {
  if (weights.length === 0) return [];
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  let total = clean.reduce((a, b) => a + b, 0);
  const base = total > 0 ? clean : clean.map(() => 1);
  total = base.reduce((a, b) => a + b, 0);
  const hundredths = base.map((w) => Math.round((w / total) * 100));
  const drift = 100 - hundredths.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    // Put the rounding drift on the largest weight.
    let idx = 0;
    hundredths.forEach((h, i) => {
      if (h > hundredths[idx]) idx = i;
    });
    hundredths[idx] += drift;
  }
  return hundredths.map((h) => h / 100);
}

function sanitizeCriteria(v: unknown, warnings: string[]): DraftCriterion[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const used = new Set<string>();
  const rows = v
    .filter(isObj)
    .slice(0, 12)
    .map((c) => {
      const name = str(c.name, 80);
      if (!name) return null;
      let w = num(c.weight) ?? 0;
      if (w > 1) w = w / 100; // "20" meaning 20%
      const rawKey = str(c.key, 40);
      const key = uniqueKey(rawKey && /^[a-zA-Z][a-zA-Z0-9]*$/.test(rawKey) ? rawKey : camelKey(name), used);
      return { name, key, weight: w, description: str(c.description, 400) ?? "" };
    })
    .filter((c): c is DraftCriterion => !!c);
  if (rows.length === 0) return [];
  const sum = rows.reduce((a, c) => a + c.weight, 0);
  const normalised = normalizeWeights(rows.map((r) => r.weight));
  if (Math.abs(sum - 1) > 0.005) warnings.push(`Criteria weights summed to ${sum.toFixed(2)} — normalised to 1.00.`);
  return rows.map((r, i) => ({ ...r, weight: normalised[i] }));
}

function sanitizeScale(v: unknown, warnings: string[]): ScoringScale | undefined {
  if (!isObj(v)) return undefined;
  const min = num(v.min);
  const max = num(v.max);
  if (min === undefined || max === undefined || !(max > min) || min < 0 || max > 1000) {
    warnings.push("Scoring scale was invalid — kept 0–100.");
    return { min: 0, max: 100, step: 1 };
  }
  const stepRaw = num(v.step);
  const step = stepRaw && stepRaw > 0 && stepRaw <= max - min ? stepRaw : 1;
  const labels = Array.isArray(v.labels)
    ? v.labels
        .filter(isObj)
        .map((l) => ({
          min: Math.max(min, num(l.min) ?? NaN),
          max: Math.min(max, num(l.max) ?? NaN),
          label: str(l.label, 40) ?? "",
        }))
        .filter((l) => l.label && Number.isFinite(l.min) && Number.isFinite(l.max) && l.max >= l.min)
        .slice(0, 10)
    : [];
  return { min, max, step, ...(labels.length ? { labels } : {}) };
}

function sanitizeFields(v: unknown, validPhases: number[] | null, warnings: string[]): SubmissionField[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const used = new Set<string>();
  const out: SubmissionField[] = [];
  for (const raw of v.filter(isObj).slice(0, 30)) {
    const label = str(raw.label ?? raw.name, 120);
    if (!label) continue;
    let type = (typeof raw.type === "string" ? raw.type : "text") as SubmissionFieldType;
    if (!FIELD_TYPES.includes(type)) type = "text";
    const rawKey = str(raw.key, 40);
    const key = uniqueKey(rawKey && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(rawKey) ? rawKey : camelKey(label), used);
    const f: SubmissionField = { key, label, type, required: bool(raw.required) ?? false };
    const placeholder = str(raw.placeholder, 200);
    const helpText = str(raw.helpText, 300);
    if (placeholder) f.placeholder = placeholder;
    if (helpText) f.helpText = helpText;
    if (Array.isArray(raw.phases) && raw.phases.length > 0) {
      const phases = Array.from(
        new Set(raw.phases.map((p) => int(p, 1, 50)).filter((p): p is number => p !== undefined)),
      )
        .filter((p) => !validPhases || validPhases.includes(p))
        .sort((a, b) => a - b);
      if (phases.length === 0) {
        warnings.push(`Dropped field "${label}" — it referenced rounds that don't exist.`);
        continue;
      }
      f.phases = phases;
    }
    if (type === "file" || type === "fileList") {
      const accept = str(raw.accept, 120)
        ?.split(",")
        .map((x) => x.trim().toLowerCase())
        .filter((x) => /^\.[a-z0-9]{1,8}$/.test(x))
        .join(",");
      f.accept = accept || ".pdf,.doc,.docx,.ppt,.pptx";
      f.maxSizeMb = int(raw.maxSizeMb, 1, 100) ?? 25;
    }
    if (type === "select") {
      const options = strList(raw.options, 20, 80);
      if (options.length === 0) {
        f.type = "text";
      } else {
        f.options = options;
      }
    }
    out.push(f);
  }
  return out;
}

function sanitizeTerminology(v: unknown): Terminology | undefined {
  if (!isObj(v)) return undefined;
  const out: Terminology = {};
  for (const k of TERM_KEYS) {
    const s = str(v[k], 30);
    if (s) out[k] = s;
  }
  return out;
}

function sanitizeRoles(v: unknown): DraftRole[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: DraftRole[] = [];
  for (const r of v.filter(isObj).slice(0, 12)) {
    const role = str(r.role ?? r.name, 60);
    if (!role || seen.has(role.toLowerCase())) continue;
    seen.add(role.toLowerCase());
    out.push({ role, maxPerTeam: int(r.maxPerTeam, 1, 20) ?? 1 });
  }
  return out;
}

function sanitizePrizes(v: unknown): DraftPrize[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const colors = ["gold", "silver", "bronze"];
  return v
    .filter(isObj)
    .slice(0, 10)
    .map((p, i) => {
      const rank = int(p.rank, 1, 100) ?? i + 1;
      const amount = num(p.amount);
      const color = str(p.color, 20);
      return {
        rank,
        label: str(p.label, 80) ?? `Rank ${rank}`,
        amount: amount !== undefined && amount >= 0 ? Math.round(amount) : null,
        color: color && /^[#a-zA-Z0-9-]+$/.test(color) ? color : (colors[rank - 1] ?? "purple"),
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

function sanitizeFaq(v: unknown): DraftFaq[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter(isObj)
    .map((f) => ({ question: str(f.question ?? f.q, 300) ?? "", answer: str(f.answer ?? f.a, 1500) ?? "" }))
    .filter((f) => f.question && f.answer)
    .slice(0, 30);
}

function sanitizeSpeakers(v: unknown): Speaker[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: Speaker[] = [];
  v.filter(isObj)
    .slice(0, 40)
    .forEach((s, i) => {
      const name = str(s.name, 120);
      if (!name) return;
      const roles = (Array.isArray(s.roles) ? s.roles : [s.role]).filter((r): r is SpeakerRole =>
        SPEAKER_ROLES.includes(r as SpeakerRole),
      );
      const id = str(s.id, 60);
      const photoUrl = str(s.photoUrl, 500);
      const sp: Speaker = {
        id: id && /^[\w-]+$/.test(id) ? id : shortId("spk", i, name),
        name,
        roles: roles.length ? Array.from(new Set(roles)) : ["speaker"],
      };
      const title = str(s.title, 120);
      const org = str(s.org ?? s.organization, 120);
      const bio = str(s.bio, 800);
      if (title) sp.title = title;
      if (org) sp.org = org;
      if (bio) sp.bio = bio;
      if (photoUrl && /^https:\/\//i.test(photoUrl)) sp.photoUrl = photoUrl;
      out.push(sp);
    });
  return out;
}

function sanitizeAgenda(v: unknown, speakerIds: Set<string> | null, warnings: string[]): AgendaItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const hhmm = (x: unknown) => (typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.trim()) ? x.trim() : undefined);
  let dropped = 0;
  const out: AgendaItem[] = [];
  v.filter(isObj)
    .slice(0, 80)
    .forEach((a, i) => {
      const title = str(a.title, 160);
      const day = isoDate(a.day ?? a.date);
      if (!title || !day) {
        dropped++;
        return;
      }
      const kind = AGENDA_KINDS.includes(a.kind as AgendaKind) ? (a.kind as AgendaKind) : "other";
      const id = str(a.id, 60);
      const item: AgendaItem = {
        id: id && /^[\w-]+$/.test(id) ? id : shortId("ag", i, `${day}${title}`),
        day,
        start: hhmm(a.start) ?? "10:00",
        title,
        kind,
      };
      const end = hhmm(a.end);
      if (end) item.end = end;
      const venue = str(a.venue, 120);
      const description = str(a.description, 600);
      if (venue) item.venue = venue;
      if (description) item.description = description;
      const sids = strList(a.speakerIds, 10, 60).filter((s) => !speakerIds || speakerIds.has(s));
      if (sids.length) item.speakerIds = sids;
      out.push(item);
    });
  if (dropped) warnings.push(`Dropped ${dropped} agenda item(s) without a title or a valid day.`);
  return out.sort((a, b) => `${a.day} ${a.start}`.localeCompare(`${b.day} ${b.start}`));
}

function sanitizeSettings(v: unknown): DraftSettings | undefined {
  if (!isObj(v)) return undefined;
  const out: DraftSettings = {};
  const theme = str(v.theme, 200);
  if (theme) out.theme = theme;
  for (const k of ["exclusiveTracks", "showcaseEnabled", "assistantEnabled"] as const) {
    const b = bool(v[k]);
    if (b !== undefined) out[k] = b;
  }
  if (v.feedbackVisibility === "never" || v.feedbackVisibility === "after_results") {
    out.feedbackVisibility = v.feedbackVisibility;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SanitizeContext {
  mode: "create" | "edit";
  /** Edit mode: the contest's current config (used to validate field → round references and merge settings). */
  current?: {
    phaseConfig?: unknown;
    speakers?: unknown;
    settings?: unknown;
    terminology?: unknown;
  };
}

/**
 * Validate + normalise untrusted draft JSON. Unknown keys are dropped, strings
 * clamped, weights normalised, dates → yyyy-mm-dd, field keys made unique.
 *
 * create mode: missing core sections are filled from the preset, so the result
 * is always a complete, valid contest.
 * edit mode: only keys present in the input are returned (a patch); settings
 * and terminology are merged over the current values so a PUT never drops keys.
 */
export function sanitizeDraft(raw: unknown, ctx: SanitizeContext): { draft: ContestDraft; warnings: string[] } {
  const warnings: string[] = [];
  const r: Obj = isObj(raw) ? raw : {};
  const d: ContestDraft = {};

  if (isContestType(r.contestType)) d.contestType = r.contestType;

  const name = str(r.name, 120);
  if (name) d.name = name;
  const slugIn = typeof r.slug === "string" ? slugify(r.slug) : undefined;
  if (slugIn) d.slug = slugIn;

  const texts: Array<[keyof ContestDraftShape, number]> = [
    ["description", 2000],
    ["heroTitle", 160],
    ["heroSubtitle", 240],
    ["heroCtaText", 40],
    ["rulesContent", 10000],
    ["eligibilityRules", 3000],
    ["teamStructureRules", 3000],
    ["deliverableRules", 3000],
  ];
  for (const [k, max] of texts) {
    const s = str(r[k], max);
    if (s) (d as Obj)[k] = s;
  }
  for (const k of ["startDate", "endDate", "registrationDeadline"] as const) {
    const s = isoDate(r[k]);
    if (s) d[k] = s;
  }
  const maxTeams = int(r.maxTeams, 1, 1000);
  if (maxTeams !== undefined) d.maxTeams = maxTeams;
  const maxApproved = int(r.maxApprovedTeams, 1, 1000);
  if (maxApproved !== undefined) d.maxApprovedTeams = maxApproved;
  const maxMembers = int(r.maxTeamMembers, 1, 20);
  if (maxMembers !== undefined) d.maxTeamMembers = maxMembers;
  const email = str(r.supportEmail, 200);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) d.supportEmail = email;

  const tracks = sanitizeTracks(r.tracks ?? r.categories);
  if (tracks) d.tracks = tracks;
  const phases = sanitizePhases(r.phaseConfig ?? r.rounds ?? r.phases);
  if (phases) d.phaseConfig = phases;
  const criteria = sanitizeCriteria(r.scoringCriteria ?? r.criteria, warnings);
  if (criteria) d.scoringCriteria = criteria;
  const scale = sanitizeScale(r.scoringScale, warnings);
  if (scale) d.scoringScale = scale;
  const terms = sanitizeTerminology(r.terminology);
  if (terms) d.terminology = terms;
  const roles = sanitizeRoles(r.roleConfig ?? r.roles);
  if (roles) d.roleConfig = roles;
  const prizes = sanitizePrizes(r.prizes);
  if (prizes) d.prizes = prizes;
  const faq = sanitizeFaq(r.faqConfig ?? r.faq);
  if (faq) d.faqConfig = faq;
  const speakers = sanitizeSpeakers(r.speakers);
  if (speakers) d.speakers = speakers;
  const settings = sanitizeSettings(r.settings);
  if (settings) d.settings = settings;
  // A top-level "theme" is a common model shortcut.
  const theme = str(r.theme, 200);
  if (theme) d.settings = { ...(d.settings ?? {}), theme };

  // ---- create mode: fill everything else from the preset -------------------
  if (ctx.mode === "create") {
    const type: ContestType = d.contestType ?? "hackathon";
    const preset = getPreset(type);
    d.contestType = type;
    d.name = d.name ?? preset.heroTitle;
    d.slug = d.slug ?? slugify(d.name);
    if (!d.slug) d.slug = `contest-${Date.now().toString(36)}`;
    d.description = d.description ?? preset.description;
    d.heroTitle = d.heroTitle ?? d.name;
    d.heroSubtitle = d.heroSubtitle ?? d.settings?.theme ?? preset.heroSubtitle;
    d.heroCtaText = d.heroCtaText ?? preset.heroCtaText;
    d.eligibilityRules = d.eligibilityRules ?? (preset.rules.eligibilityRules || undefined);
    d.teamStructureRules = d.teamStructureRules ?? (preset.rules.teamStructureRules || undefined);
    d.deliverableRules = d.deliverableRules ?? (preset.rules.deliverableRules || undefined);
    if (!d.eligibilityRules) delete d.eligibilityRules;
    if (!d.teamStructureRules) delete d.teamStructureRules;
    if (!d.deliverableRules) delete d.deliverableRules;
    d.tracks = d.tracks ?? preset.tracks.map((t) => ({ ...t }));
    d.phaseConfig = d.phaseConfig?.length ? d.phaseConfig : (sanitizePhases(preset.phaseConfig) ?? []);
    d.scoringCriteria = d.scoringCriteria?.length ? d.scoringCriteria : preset.scoringCriteria.map((c) => ({ ...c }));
    d.scoringScale = d.scoringScale ?? preset.scoringScale;
    d.terminology = { ...preset.terminology, ...(d.terminology ?? {}) };
    d.roleConfig = d.roleConfig?.length ? d.roleConfig : preset.roleConfig.map((x) => ({ ...x }));
    d.prizes = d.prizes?.length ? d.prizes : preset.prizes.map((x) => ({ ...x }));
    d.maxTeamMembers = d.maxTeamMembers ?? preset.maxTeamMembers;
    d.maxTeams = d.maxTeams ?? preset.maxTeams;
    d.maxApprovedTeams = d.maxApprovedTeams ?? preset.maxApprovedTeams;
    d.settings = { ...preset.settings, ...(d.settings ?? {}) };
    delete d.settings.resultsPublished;
  }

  // ---- cross-field validation ---------------------------------------------
  const currentPhases = sanitizePhases(ctx.current?.phaseConfig);
  const phaseList = d.phaseConfig ?? currentPhases ?? null;
  const validPhaseNums = phaseList ? phaseList.map((p) => p.phase) : null;

  const rawFields = r.submissionFields ?? r.fields;
  if (rawFields !== undefined) {
    const fields = sanitizeFields(rawFields, validPhaseNums, warnings);
    if (fields) d.submissionFields = fields;
  } else if (ctx.mode === "create") {
    d.submissionFields = sanitizeFields(getPreset(d.contestType).submissionFields, validPhaseNums, warnings) ?? [];
  }

  const speakerIdSet = d.speakers
    ? new Set(d.speakers.map((s) => s.id))
    : Array.isArray(ctx.current?.speakers)
      ? new Set((ctx.current!.speakers as Speaker[]).map((s) => s?.id).filter(Boolean))
      : null;
  const agenda = sanitizeAgenda(r.agenda, speakerIdSet, warnings);
  if (agenda) d.agenda = agenda;

  if (d.maxTeams !== undefined && d.maxApprovedTeams !== undefined && d.maxApprovedTeams > d.maxTeams) {
    d.maxApprovedTeams = d.maxTeams;
  }
  if (d.startDate && d.endDate && d.endDate < d.startDate) {
    warnings.push("End date was before the start date — swapped them.");
    [d.startDate, d.endDate] = [d.endDate, d.startDate];
  }
  if (d.phaseConfig && d.phaseConfig.length) {
    const pts = d.phaseConfig.reduce((a, p) => a + p.maxPoints, 0);
    if (pts > 0 && pts !== 100) warnings.push(`Round points add up to ${pts} (usually 100).`);
    for (const p of d.phaseConfig) {
      if (p.startDate && p.endDate && p.endDate < p.startDate) {
        warnings.push(`${p.name}: end date is before start date.`);
      }
    }
  }

  // ---- edit mode: merge object-valued keys over current ---------------------
  if (ctx.mode === "edit") {
    if (d.settings) {
      const cur = isObj(ctx.current?.settings) ? ctx.current!.settings : {};
      d.settings = { ...cur, ...d.settings };
    }
    if (d.terminology) {
      const cur = isObj(ctx.current?.terminology) ? (ctx.current!.terminology as Terminology) : {};
      d.terminology = { ...cur, ...d.terminology };
    }
  }

  return { draft: d, warnings };
}

/** Human-friendly list of which draft sections are present (for "changes" chips). */
export function draftKeys(d: ContestDraft | null | undefined): string[] {
  if (!d) return [];
  return DRAFT_KEYS.filter((k) => d[k] !== undefined);
}
