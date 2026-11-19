/**
 * Shared, client-safe types + helpers for the per-contest configuration that
 * drives the generic engine (submission fields, scoring scale, vocabulary,
 * settings, agenda, speakers, live finale). No DB imports — this file is used
 * by both server routes and client components.
 */

export type ContestType = "hackathon" | "business_symposium" | "ideathon";

export const CONTEST_TYPES: ContestType[] = ["hackathon", "business_symposium", "ideathon"];

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
  | "select"
  | "multiselect"
  | "number"
  | "agentCharter";

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
  /** For select / multiselect fields */
  options?: string[];
  /** For number fields */
  min?: number;
  max?: number;
  /**
   * Only required when the team declared one of these solution paths
   * (Ideathon). The field is still shown to everyone.
   */
  requiredForPaths?: string[];
}

/** One agent in an Agent Charter (Ideathon). */
export interface AgentCharterEntry {
  name: string;
  platform: string;
  task: string;
  /** L1 Assist | L2 Copilot | L3 Agent-with-approval | L4 Autonomous-with-guardrails */
  autonomy: string;
  humanCheckpoint: string;
  dataAccessed: string;
  guardrails: string;
  monthlyCostInr?: number | null;
}

export const AUTONOMY_LEVELS = [
  { key: "L1", label: "L1 · Assist", hint: "AI suggests, a human does the work" },
  { key: "L2", label: "L2 · Copilot", hint: "AI drafts, a human reviews every output" },
  { key: "L3", label: "L3 · Agent with approval", hint: "AI acts, a human approves key steps" },
  { key: "L4", label: "L4 · Autonomous with guardrails", hint: "AI acts alone inside hard limits" },
] as const;

/**
 * Stored values are strings or string lists. `multiselect` is a string list,
 * `number` a numeric string and `agentCharter` a JSON-encoded
 * AgentCharterEntry[] (see parseAgentCharter in lib/submission-fields.ts).
 */
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

export type TermKey = "track" | "team" | "phase" | "judge" | "submission" | "member" | "contest" | "validator";

export type Terminology = Partial<Record<TermKey, string>>;

const BASE_TERMS: Record<TermKey, string> = {
  track: "Track",
  team: "Team",
  phase: "Phase",
  judge: "Judge",
  submission: "Submission",
  member: "Member",
  contest: "Contest",
  validator: "Validator",
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
  // ---- Ideathon ----
  /** Canonical department list; enrolment/profile show a select when set. */
  departments?: string[];
  /** Teams must span at least this many departments before submitting. */
  minDepartmentsPerTeam?: number;
  /** Minimum crew size (max is contests.maxTeamMembers). */
  minTeamMembers?: number;
  /** Show the Problem Bank (problem_statements) instead of free-form tracks only. */
  problemBankEnabled?: boolean;
  /** Solution paths a team can declare (e.g. Process Re-engineering, Agent Build). */
  solutionPaths?: string[];
  /** Enable validated before/after impact metrics + validators. */
  impactMetricsEnabled?: boolean;
  /** Show a "demo data" banner on every page. */
  demoBanner?: boolean;
  /**
   * Walkthrough video shown in the "Create team" dialog (Vimeo/YouTube/MP4 URL).
   * Unset → default for the contest type; "" → no video.
   */
  teamCreationVideoUrl?: string;
  /** Label for the optional per-person ID (e.g. "Enrollment Number", "Employee ID"). Unset → by contest type. */
  memberIdLabel?: string;
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
    departments: Array.isArray(s.departments) ? s.departments.filter((d) => typeof d === "string" && d.trim()) : undefined,
    minDepartmentsPerTeam: typeof s.minDepartmentsPerTeam === "number" ? s.minDepartmentsPerTeam : undefined,
    minTeamMembers: typeof s.minTeamMembers === "number" ? s.minTeamMembers : undefined,
    problemBankEnabled: !!s.problemBankEnabled,
    solutionPaths: Array.isArray(s.solutionPaths) ? s.solutionPaths.filter((d) => typeof d === "string" && d.trim()) : undefined,
    impactMetricsEnabled: !!s.impactMetricsEnabled,
    demoBanner: !!s.demoBanner,
    // "" is kept on purpose: it means "no video" and overrides the type default (see teamCreationVideo()).
    teamCreationVideoUrl: typeof s.teamCreationVideoUrl === "string" ? s.teamCreationVideoUrl.trim() : undefined,
    memberIdLabel: typeof s.memberIdLabel === "string" && s.memberIdLabel.trim() ? s.memberIdLabel.trim().slice(0, 60) : undefined,
  };
}

/** Default "how to create your team" walkthrough for business symposiums. */
export const DEFAULT_SYMPOSIUM_TEAM_VIDEO = "https://player.vimeo.com/video/1247499964";

/** The video to show when creating a team, or null for none. */
export function teamCreationVideo(contest: { contestType?: string | null; settings?: unknown }): string | null {
  const v = resolveSettings(contest.settings).teamCreationVideoUrl;
  if (v !== undefined) return v || null;
  return contest.contestType === "business_symposium" ? DEFAULT_SYMPOSIUM_TEAM_VIDEO : null;
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
