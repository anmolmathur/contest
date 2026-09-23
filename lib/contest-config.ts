/**
 * Shared, client-safe types + helpers for the per-contest configuration that
 * drives the generic engine (submission fields, scoring scale, vocabulary,
 * settings, agenda, speakers, live finale). No DB imports — this file is used
 * by both server routes and client components.
 */

export type ContestType = "hackathon" | "business_symposium";

export const CONTEST_TYPES: ContestType[] = ["hackathon", "business_symposium"];

export function isContestType(v: unknown): v is ContestType {
  return typeof v === "string" && (CONTEST_TYPES as string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Submission fields
// ---------------------------------------------------------------------------

export type SubmissionFieldType =
  | "text"
  | "textarea"
  | "url"
  | "urlList"
  | "file"
  | "fileList"
  | "select";

export interface SubmissionField {
  key: string;
  label: string;
  type: SubmissionFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** Phases (rounds) this field applies to. Empty/undefined = every scorable phase. */
  phases?: number[];
  /** For file fields: comma-separated extensions, e.g. ".pdf,.pptx" */
  accept?: string;
  maxSizeMb?: number;
  /** For select fields */
  options?: string[];
}

export type SubmissionValues = Record<string, string | string[]>;

// ---------------------------------------------------------------------------
// Scoring scale
// ---------------------------------------------------------------------------

export interface ScoreLabel {
  min: number;
  max: number;
  label: string;
}

export interface ScoringScale {
  min: number;
  max: number;
  step: number;
  labels?: ScoreLabel[];
}

export const DEFAULT_SCORING_SCALE: ScoringScale = { min: 0, max: 100, step: 1 };

export function resolveScale(raw: unknown): ScoringScale {
  const s = (raw ?? {}) as Partial<ScoringScale>;
  const min = typeof s.min === "number" ? s.min : DEFAULT_SCORING_SCALE.min;
  const max = typeof s.max === "number" && s.max > min ? s.max : DEFAULT_SCORING_SCALE.max;
  const step = typeof s.step === "number" && s.step > 0 ? s.step : 1;
  return { min, max, step, labels: Array.isArray(s.labels) ? s.labels : undefined };
}

export function scaleLabelFor(scale: ScoringScale, value: number): string | null {
  return scale.labels?.find((l) => value >= l.min && value <= l.max)?.label ?? null;
}

/** Default value a judge sees before touching the input (midpoint, snapped to step). */
export function scaleDefault(scale: ScoringScale): number {
  const mid = scale.min + (scale.max - scale.min) / 2;
  return Math.round(mid / scale.step) * scale.step;
}

// ---------------------------------------------------------------------------
// Terminology
// ---------------------------------------------------------------------------

export type TermKey = "track" | "team" | "phase" | "judge" | "submission" | "member" | "contest";

export type Terminology = Partial<Record<TermKey, string>>;

const BASE_TERMS: Record<TermKey, string> = {
  track: "Track",
  team: "Team",
  phase: "Phase",
  judge: "Judge",
  submission: "Submission",
  member: "Member",
  contest: "Contest",
};

/** Singular term, falling back to the generic English default. */
export function term(t: Terminology | null | undefined, key: TermKey): string {
  const v = t?.[key];
  return v && v.trim() ? v.trim() : BASE_TERMS[key];
}

/** Naive plural — good enough for the vocabulary we allow (Track/Category/Round/Jury…). */
export function termPlural(t: Terminology | null | undefined, key: TermKey): string {
  const w = term(t, key);
  if (/jury$/i.test(w)) return w; // "Jury" stays "Jury"
  if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + "ies"; // Category → Categories
  if (/(s|x|ch|sh)$/i.test(w)) return w + "es";
  return w + "s";
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ContestSettings {
  /** One team per track/category (e.g. "12 problem statements, each picked once"). */
  exclusiveTracks?: boolean;
  /** When teams can see jury feedback. */
  feedbackVisibility?: "never" | "after_results";
  /** Admin flipped the "results published" switch (drives feedback visibility + notifications). */
  resultsPublished?: boolean;
  /** Public showcase gallery of team entries. */
  showcaseEnabled?: boolean;
  /** Show the AI assistant widget to visitors/participants. Default true. */
  assistantEnabled?: boolean;
  /** Theme line displayed on the landing page (e.g. symposium theme). */
  theme?: string;
  /** Default colour mode for visitors (they can still toggle). Unset → by contest type. */
  colorMode?: "light" | "dark";
}

export function resolveSettings(raw: unknown): ContestSettings {
  const s = (raw ?? {}) as ContestSettings;
  return {
    exclusiveTracks: !!s.exclusiveTracks,
    feedbackVisibility: s.feedbackVisibility ?? "after_results",
    resultsPublished: !!s.resultsPublished,
    showcaseEnabled: !!s.showcaseEnabled,
    assistantEnabled: s.assistantEnabled !== false,
    theme: s.theme ?? undefined,
    colorMode: s.colorMode === "light" || s.colorMode === "dark" ? s.colorMode : undefined,
  };
}

/** Can a team see jury feedback right now? */
export function feedbackVisibleToTeams(settings: ContestSettings, status: string): boolean {
  if (settings.feedbackVisibility === "never") return false;
  return !!settings.resultsPublished || status === "completed";
}

// ---------------------------------------------------------------------------
// Agenda + speakers
// ---------------------------------------------------------------------------

export type AgendaKind =
  | "keynote"
  | "panel"
  | "expert_session"
  | "startup_story"
  | "workshop"
  | "pitch"
  | "networking"
  | "ceremony"
  | "break"
  | "other";

export const AGENDA_KIND_LABELS: Record<AgendaKind, string> = {
  keynote: "Keynote",
  panel: "Panel Discussion",
  expert_session: "Industry Expert Session",
  startup_story: "Startup Success Story",
  workshop: "Workshop",
  pitch: "Pitches",
  networking: "Networking",
  ceremony: "Ceremony",
  break: "Break",
  other: "Session",
};

export interface AgendaItem {
  id: string;
  /** ISO date (yyyy-mm-dd) */
  day: string;
  /** HH:mm */
  start: string;
  end?: string;
  title: string;
  kind: AgendaKind;
  speakerIds?: string[];
  venue?: string;
  description?: string;
}

export type SpeakerRole = "speaker" | "panelist" | "jury" | "mentor" | "host";

export interface Speaker {
  id: string;
  name: string;
  title?: string;
  org?: string;
  bio?: string;
  photoUrl?: string;
  roles: SpeakerRole[];
}

// ---------------------------------------------------------------------------
// Live finale
// ---------------------------------------------------------------------------

export interface LiveState {
  phase: number | null;
  currentTeamId: string | null;
  scoringOpen: boolean;
  queue: string[];
  /** Epoch ms when the current pitch timer ends (null = no timer) */
  timerEndsAt: number | null;
  /** hidden = stage shows no scores; partial = positions 4+; full = full podium */
  revealStage: "hidden" | "partial" | "full";
  updatedAt?: number;
}

export const EMPTY_LIVE_STATE: LiveState = {
  phase: null,
  currentTeamId: null,
  scoringOpen: false,
  queue: [],
  timerEndsAt: null,
  revealStage: "hidden",
};

export function resolveLiveState(raw: unknown): LiveState {
  const s = (raw ?? {}) as Partial<LiveState>;
  return {
    phase: typeof s.phase === "number" ? s.phase : null,
    currentTeamId: s.currentTeamId ?? null,
    scoringOpen: !!s.scoringOpen,
    queue: Array.isArray(s.queue) ? s.queue : [],
    timerEndsAt: typeof s.timerEndsAt === "number" ? s.timerEndsAt : null,
    revealStage: s.revealStage === "partial" || s.revealStage === "full" ? s.revealStage : "hidden",
    updatedAt: s.updatedAt,
  };
}
