/**
 * SETUP mode of the Contest Assistant: turns an organiser's plain-language
 * brief (plus follow-up chat) into a ContestDraft. Server-only helpers used by
 * POST /api/ai/contest-setup: system prompt, deterministic mock generator.
 */
import { CONTEST_PRESETS, getPreset, type ContestPreset } from "@/lib/contest-types";
import type { ContestType } from "@/lib/contest-config";
import { SCOPE_RULES_SETUP } from "@/lib/ai/guardrails";
import { slugify, type ContestDraft, type DraftPhase } from "@/lib/ai/contest-draft";

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const DRAFT_SCHEMA = `
type ContestDraft = {
  contestType?: "hackathon" | "business_symposium";
  name?: string;                 // <= 120 chars
  slug?: string;                 // lowercase-hyphen, e.g. "bizfest-2026"
  description?: string;          // 1-3 sentences
  heroTitle?: string; heroSubtitle?: string; heroCtaText?: string;
  rulesContent?: string;         // markdown, general rules
  eligibilityRules?: string; teamStructureRules?: string; deliverableRules?: string;
  startDate?: string; endDate?: string; registrationDeadline?: string;   // "yyyy-mm-dd"
  maxTeams?: number; maxApprovedTeams?: number; maxTeamMembers?: number;
  supportEmail?: string;
  tracks?: { name: string; description: string; icon?: string }[];      // categories / tracks / problem statements; icon = a lucide-react icon name e.g. "Rocket"
  phaseConfig?: {                // rounds, numbered from 1
    phase: number; name: string; maxPoints: number;                     // non-scored rounds use 0
    startDate: string; endDate: string;                                 // "yyyy-mm-dd" or ""
    description: string; details: string[];                             // details = activities
    deliverables: string[];
  }[];
  scoringCriteria?: { name: string; key: string; weight: number; description: string }[];  // key camelCase, weights sum to 1.0
  scoringScale?: { min: number; max: number; step: number; labels?: { min: number; max: number; label: string }[] };
  submissionFields?: {
    key: string;                 // camelCase, unique
    label: string;
    type: "text" | "textarea" | "url" | "urlList" | "file" | "fileList" | "select";
    required: boolean;
    placeholder?: string; helpText?: string;
    phases?: number[];           // rounds where this field is asked; omit = every round
    accept?: string;             // file types only, e.g. ".pdf,.pptx"
    maxSizeMb?: number;          // file types only
    options?: string[];          // select only
  }[];
  terminology?: { track?: string; team?: string; phase?: string; judge?: string; submission?: string; member?: string; contest?: string };
  roleConfig?: { role: string; maxPerTeam: number }[];
  prizes?: { rank: number; label: string; amount: number | null; color: "gold" | "silver" | "bronze" | string }[];
  faqConfig?: { question: string; answer: string }[];
  agenda?: { id: string; day: string; start: string; end?: string; title: string;
             kind: "keynote" | "panel" | "expert_session" | "startup_story" | "workshop" | "pitch" | "networking" | "ceremony" | "break" | "other";
             speakerIds?: string[]; venue?: string; description?: string }[];   // day "yyyy-mm-dd", times "HH:mm"
  speakers?: { id: string; name: string; title?: string; org?: string; bio?: string; roles: ("speaker" | "panelist" | "jury" | "mentor" | "host")[] }[];
  settings?: { theme?: string; exclusiveTracks?: boolean; showcaseEnabled?: boolean; feedbackVisibility?: "never" | "after_results"; assistantEnabled?: boolean; colorMode?: "light" | "dark" /* default appearance; hackathons usually dark, symposiums light */ };
};`.trim();

function presetExample(p: ContestPreset) {
  return {
    contestType: p.type,
    name: p.heroTitle,
    description: p.description,
    heroSubtitle: p.heroSubtitle,
    terminology: p.terminology,
    maxTeamMembers: p.maxTeamMembers,
    roleConfig: p.roleConfig,
    tracks: p.tracks.slice(0, 3),
    phaseConfig: p.phaseConfig.map((ph) => ({
      phase: ph.phase,
      name: ph.name,
      maxPoints: ph.maxPoints,
      description: ph.description,
      deliverables: ph.deliverables,
    })),
    scoringCriteria: p.scoringCriteria.map((c) => ({ name: c.name, key: c.key, weight: c.weight })),
    scoringScale: p.scoringScale,
    submissionFields: p.submissionFields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      ...(f.phases ? { phases: f.phases } : {}),
      ...(f.accept ? { accept: f.accept, maxSizeMb: f.maxSizeMb } : {}),
    })),
    prizes: p.prizes,
    settings: p.settings,
  };
}

export function buildSetupSystemPrompt(opts: {
  mode: "create" | "edit";
  today: string;
  current?: Record<string, unknown> | null;
  workingDraft?: ContestDraft | null;
}): string {
  const lines: string[] = [];
  lines.push(
    "You are the Contest Setup Assistant of a contest platform (hackathons and business symposiums).",
    opts.mode === "create"
      ? "An organiser describes a NEW contest in plain language. Turn it into a complete configuration draft."
      : "A contest admin asks for changes to an EXISTING contest. Return ONLY the keys that change (a patch).",
    `Today is ${opts.today}.`,
    "",
    SCOPE_RULES_SETUP,
    "",
    "# Output",
    'Always respond with a single JSON object: {"reply": string, "draft": ContestDraft | null, "outOfScope": boolean}.',
    '- "reply": 1-4 short sentences for the admin: what you set up / changed and any assumptions; ask at most ONE clarifying question if something essential is missing (you may still return a best-guess draft).',
    '- "draft": the configuration (see schema). null when refusing, or when you only need to ask a question and have nothing to propose.',
    '- "outOfScope": true only when refusing.',
    "",
    "# ContestDraft schema (TypeScript)",
    DRAFT_SCHEMA,
    "",
    "# Rules",
    "- contestType: business_symposium for pitch / business-plan / case / B-school / management competitions; hackathon for build / coding / tech / AI product challenges.",
    "- Terminology: business_symposium uses Category / Round / Jury / Entry; hackathon uses Track / Phase / Judge / Submission unless the organiser asks otherwise.",
    "- scoringCriteria weights are decimals that sum to exactly 1.0. keys are unique camelCase.",
    "- phaseConfig rounds are numbered 1..n in order. maxPoints of scored rounds typically sum to 100; registration/awards rounds use 0.",
    "- submissionFields: keys unique camelCase; type is one of text|textarea|url|urlList|file|fileList|select; file/fileList need accept (comma-separated extensions) and maxSizeMb; select needs options; phases must reference existing round numbers.",
    "- scoringScale is either {min:0,max:100,step:1} or {min:1,max:10,step:1} with labels (e.g. 9-10 Exceptional, 7-8 Strong, 5-6 Average, 3-4 Weak, 1-2 Poor).",
    "- Dates are yyyy-mm-dd. Resolve relative dates (\"7 Nov\", \"in 3 weeks\") against today and pick the next future occurrence. Leave dates \"\" when unknown — never invent specific dates that the organiser did not imply.",
    "- slug: lowercase letters, digits and hyphens only.",
    "- Agenda / speakers: when the organiser mentions keynotes, panels or a finale, add agenda placeholders on the finale day and speakers with placeholder names like \"Keynote Speaker (TBC)\"; never invent real people.",
    "- Prize amounts: use null unless the organiser gives amounts.",
    "- Write concise, professional copy. No emojis.",
  );
  if (opts.mode === "create") {
    lines.push(
      "- CREATE mode: return a FULL draft (every key you can fill). Start from the closest preset below and adapt it to the brief (number of categories, rounds, audience, dates, team size, criteria).",
      "- If the conversation already produced a working draft (below), return the whole updated draft with the requested changes applied.",
    );
  } else {
    lines.push(
      "- EDIT mode: return ONLY changed top-level keys. For arrays (tracks, phaseConfig, scoringCriteria, submissionFields, roleConfig, prizes, faqConfig, agenda, speakers) return the COMPLETE new array, not just the new items. For settings/terminology return only the changed sub-keys.",
      "- Do not change keys the admin did not ask about. Do not touch name/slug unless asked.",
      "- If a pending (not yet applied) patch exists below, return the combined patch (pending + new changes).",
    );
  }
  lines.push("", "# Presets (examples of the shape — adapt, don't copy blindly)");
  for (const p of Object.values(CONTEST_PRESETS)) {
    lines.push(`## ${p.type}`, JSON.stringify(presetExample(p)));
  }
  if (opts.current) {
    lines.push("", "# CURRENT contest configuration", JSON.stringify(opts.current));
  }
  if (opts.workingDraft && Object.keys(opts.workingDraft).length) {
    lines.push(
      "",
      opts.mode === "create" ? "# Working draft so far" : "# Pending patch (not yet applied)",
      JSON.stringify(opts.workingDraft),
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Mock mode (no OPENAI_API_KEY): deterministic draft from preset + brief
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmt(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Find a date like "7 Nov", "Nov 7", "7 November 2026", "2026-11-07" (next future occurrence). */
export function findDate(text: string, today: Date): Date | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const mon = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`;
  const a = new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${mon}(?:,?\s+(\d{4}))?`, "i").exec(text);
  const b = new RegExp(String.raw`\b${mon}\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?`, "i").exec(text);
  let day: number, month: number, year: number | undefined;
  if (a) {
    day = +a[1];
    month = MONTHS.indexOf(a[2].slice(0, 3).toLowerCase());
    year = a[3] ? +a[3] : undefined;
  } else if (b) {
    day = +b[2];
    month = MONTHS.indexOf(b[1].slice(0, 3).toLowerCase());
    year = b[3] ? +b[3] : undefined;
  } else return null;
  if (month < 0 || day < 1 || day > 31) return null;
  let y = year ?? today.getUTCFullYear();
  let d = new Date(Date.UTC(y, month, day));
  if (!year && d < today) {
    y += 1;
    d = new Date(Date.UTC(y, month, day));
  }
  return d;
}

const SMALL_WORDS = new Set(["for", "and", "of", "the", "a", "an", "in", "on", "to", "with", "at", "by"]);

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w, i) => {
      if (/^[A-Z0-9]{2,}$/.test(w) || /[A-Z].*[A-Z]/.test(w)) return w; // keep acronyms (MBA, AI)
      if (i > 0 && SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
      return w.replace(/(^|-)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
    })
    .join(" ");
}

export function deriveName(brief: string, type: ContestType): string {
  const quoted = /["“']([^"”']{3,80})["”']/.exec(brief);
  if (quoted) return quoted[1].trim();
  const named = /\b(?:called|named|titled)\s+([A-Z][\w&' -]{2,60}?)(?=[,.;]|\s+(?:for|with|on|in)\b|$)/.exec(brief);
  if (named) return named[1].trim();
  let clause = brief.split(/[,.;\n]/)[0] ?? "";
  clause = clause
    .replace(/^\s*(?:please\s+)?(?:set\s*up|setup|create|make|build|plan|organi[sz]e|run|we\s+(?:want|need)(?:\s+to\s+(?:run|host|organi[sz]e))?|i\s+(?:want|need)(?:\s+to\s+(?:run|host|organi[sz]e))?)\s+(?:an?\s+|the\s+|our\s+)?/i, "")
    .split(/\s+(?:with|on|in|starting|from|ending|where|that)\s+/i)[0]
    .trim();
  const name = titleCase(clause).slice(0, 80).trim();
  if (name.length >= 4) return name;
  return getPreset(type).heroTitle;
}

export function detectType(text: string): ContestType {
  return /\b(symposium|business|pitch|b-?school|mba|case\s+(?:study|competition)|startup|entrepreneur|management|bizfest|b-?plan)/i.test(text)
    ? "business_symposium"
    : "hackathon";
}

/** Build a complete, valid (pre-sanitise) draft from the preset + the conversation text. */
export function mockCreateDraft(brief: string, today: Date): { reply: string; draft: ContestDraft } {
  const type = detectType(brief);
  const preset = getPreset(type);
  const name = deriveName(brief, type);
  const notes: string[] = [];

  // Categories / problem statements
  const countMatch = /\b(\d{1,2})\s+(?:categories|category|tracks?|problem\s+statements?|challenges?|themes?|use[-\s]cases?)\b/i.exec(brief);
  let tracks = preset.tracks.map((t) => ({ ...t }));
  if (countMatch) {
    const n = Math.min(30, Math.max(1, +countMatch[1]));
    if (tracks.length >= n) tracks = tracks.slice(0, n);
    else {
      const label = type === "business_symposium" ? "Category" : "Problem Statement";
      for (let i = tracks.length; i < n; i++) {
        tracks.push({ name: `${label} ${i + 1}`, description: "Describe this challenge.", icon: "Sparkles" });
      }
    }
    notes.push(`${n} ${type === "business_symposium" ? "categories" : "problem statements"} (placeholders — rename them)`);
  }

  // Team size
  const team = /\bteams?\s+of\s+(?:up\s+to\s+)?(\d{1,2})(?:\s*(?:-|–|to)\s*(\d{1,2}))?/i.exec(brief);
  const maxTeamMembers = team ? Math.min(20, +(team[2] ?? team[1])) : preset.maxTeamMembers;

  // Timeline
  const phases: DraftPhase[] = preset.phaseConfig.map((p) => ({ ...p, details: [...p.details], deliverables: [...p.deliverables] }));
  const finale = findDate(brief, today);
  const weeksMatch = /\b(\d{1,2})[-\s]?weeks?\b/i.exec(brief);
  let startDate: string | undefined;
  let endDate: string | undefined;
  let registrationDeadline: string | undefined;
  if (finale || weeksMatch) {
    const weeks = weeksMatch ? Math.max(1, +weeksMatch[1]) : Math.max(3, phases.length);
    const end = finale ?? addDays(today, 14 + weeks * 7);
    const start = addDays(end, -weeks * 7);
    startDate = fmt(start);
    endDate = fmt(end);
    registrationDeadline = fmt(addDays(start, -3));
    // Spread rounds evenly between start and end; the last scored round ends on the finale date.
    const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    const per = Math.max(1, Math.floor(span / phases.length));
    phases.forEach((p, i) => {
      const s = addDays(start, i * per);
      const e = i === phases.length - 1 ? end : addDays(start, (i + 1) * per - 1);
      p.startDate = fmt(s);
      p.endDate = fmt(e > end ? end : e);
    });
    if (type === "business_symposium") {
      // Finale + awards on the same day
      const fin = phases.find((p) => /finale/i.test(p.name));
      if (fin) fin.startDate = fin.endDate = fmt(end);
      const aw = phases.find((p) => /award/i.test(p.name));
      if (aw) aw.startDate = aw.endDate = fmt(end);
    }
    notes.push(`timeline ${startDate} → ${endDate}`);
  }

  const audience = /\bfor\s+([^,.;]+?)(?:\s+(?:with|on|in|starting|from)\b|[,.;]|$)/i.exec(brief)?.[1]?.trim();
  const description = audience
    ? `${preset.description.replace(/\.$/, "")} Open to ${audience}.`
    : preset.description;

  const draft: ContestDraft = {
    contestType: type,
    name,
    slug: slugify(name),
    description,
    heroTitle: name,
    heroSubtitle: preset.heroSubtitle,
    heroCtaText: preset.heroCtaText,
    ...(preset.rules.eligibilityRules ? { eligibilityRules: preset.rules.eligibilityRules } : {}),
    ...(preset.rules.teamStructureRules ? { teamStructureRules: preset.rules.teamStructureRules } : {}),
    ...(preset.rules.deliverableRules ? { deliverableRules: preset.rules.deliverableRules } : {}),
    ...(startDate ? { startDate, endDate, registrationDeadline } : {}),
    maxTeamMembers,
    maxTeams: preset.maxTeams,
    maxApprovedTeams: preset.maxApprovedTeams,
    tracks,
    phaseConfig: phases,
    scoringCriteria: preset.scoringCriteria.map((c) => ({ ...c })),
    scoringScale: preset.scoringScale,
    submissionFields: preset.submissionFields.map((f) => ({ ...f })),
    terminology: { ...preset.terminology },
    roleConfig: preset.roleConfig.map((r) => ({ ...r })),
    prizes: preset.prizes.map((p) => ({ ...p })),
    settings: { ...preset.settings },
    faqConfig: [
      {
        question: "Who can participate?",
        answer: preset.rules.eligibilityRules || `Anyone who meets the eligibility rules${audience ? ` — this edition is for ${audience}` : ""}.`,
      },
      { question: "How big can a team be?", answer: `Teams can have up to ${maxTeamMembers} members.` },
    ],
  };

  if (type === "business_symposium" && endDate) {
    draft.speakers = [
      { id: "spk-keynote", name: "Keynote Speaker (TBC)", roles: ["speaker"] },
      { id: "spk-jury-1", name: "Industry Jury Member (TBC)", roles: ["jury"] },
    ];
    draft.agenda = [
      { id: "ag-1", day: endDate, start: "09:30", end: "10:15", title: "Opening Keynote", kind: "keynote", speakerIds: ["spk-keynote"] },
      { id: "ag-2", day: endDate, start: "10:30", end: "13:00", title: "Grand Finale Pitches", kind: "pitch", speakerIds: ["spk-jury-1"] },
      { id: "ag-3", day: endDate, start: "14:00", end: "15:00", title: "Panel Discussion", kind: "panel" },
      { id: "ag-4", day: endDate, start: "16:00", end: "17:00", title: "Awards & Networking", kind: "ceremony" },
    ];
  }

  const reply =
    `(mock mode — set OPENAI_API_KEY for real AI) Drafted a ${preset.label.toLowerCase()} "${name}" from the ${preset.label} preset` +
    (notes.length ? `: ${notes.join("; ")}.` : ".") +
    " Review the preview and apply it to the form.";
  return { reply, draft };
}

/** Mock edit: recognise a few common requests and emit a patch. */
export function mockEditPatch(
  text: string,
  current: Record<string, unknown>,
): { reply: string; draft: ContestDraft | null } {
  const patch: ContestDraft = {};
  const did: string[] = [];
  const t = text.toLowerCase();

  if (/\b1\s*(?:-|–|to)\s*10\b/.test(t)) {
    patch.scoringScale = getPreset("business_symposium").scoringScale;
    did.push("switched the scale to 1–10 with labels");
  } else if (/\b0\s*(?:-|–|to)\s*100\b/.test(t)) {
    patch.scoringScale = { min: 0, max: 100, step: 1 };
    did.push("switched the scale to 0–100");
  }
  const team = /\b(?:teams?\s+of\s+(?:up\s+to\s+)?|max(?:imum)?\s+(?:team\s+size\s+(?:of\s+|to\s+)?)?)(\d{1,2})\b/.exec(t);
  if (team) {
    patch.maxTeamMembers = Math.min(20, +team[1]);
    did.push(`set team size to ${patch.maxTeamMembers}`);
  }
  const theme = /\btheme\b[^"“]*["“]([^"”]{3,200})["”]/i.exec(text);
  if (theme) {
    patch.settings = { theme: theme[1] };
    did.push("updated the theme");
  }
  const rename = /\b(?:rename(?:\s+it)?(?:\s+to)?|call\s+it)\s+["“]([^"”]{3,120})["”]/i.exec(text);
  if (rename) {
    patch.name = rename[1];
    did.push(`renamed to "${rename[1]}"`);
  }
  if (/\bequal(?:ly)?\s+weight/.test(t) && Array.isArray(current.scoringCriteria)) {
    patch.scoringCriteria = (current.scoringCriteria as Array<{ name: string; key: string; description?: string }>).map((c) => ({
      name: c.name,
      key: c.key,
      description: c.description ?? "",
      weight: 1,
    }));
    did.push("gave every criterion equal weight");
  }
  const addCat = /\badd\s+(?:an?\s+)?["“]?([A-Z][\w&' -]{2,60}?)["”]?\s+(?:category|track)\b/.exec(text);
  if (addCat && Array.isArray(current.tracks)) {
    patch.tracks = [
      ...(current.tracks as Array<{ name: string; description?: string | null; icon?: string | null }>).map((x) => ({
        name: x.name,
        description: x.description ?? "",
        ...(x.icon ? { icon: x.icon } : {}),
      })),
      { name: addCat[1].trim(), description: "" },
    ];
    did.push(`added the "${addCat[1].trim()}" category`);
  }

  if (did.length === 0) {
    return {
      reply:
        '(mock mode — set OPENAI_API_KEY for real AI) Offline I only understand a few edits: "switch to a 1–10 scale", "teams of 4", "set the theme to \u201c…\u201d", "rename it to \u201c…\u201d", "equal weights", "add a \u201cFintech\u201d category".',
      draft: null,
    };
  }
  return { reply: `(mock mode) I ${did.join(", ")}. Review and apply.`, draft: patch };
}
