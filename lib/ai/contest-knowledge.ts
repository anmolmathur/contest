/**
 * CONTESTANT mode of the Contest Assistant: turns a contest row (+ its
 * tracks) into a knowledge pack for the system prompt, and a deterministic
 * keyword answer for mock mode.
 *
 * Only public, contest-level configuration goes in here — never teams,
 * submissions, scores, live state or results — so the model cannot leak
 * what it was never given.
 */
import {
  AGENDA_KIND_LABELS,
  resolveScale,
  resolveSettings,
  term,
  termPlural,
  type AgendaItem,
  type Speaker,
  type Terminology,
} from "@/lib/contest-config";
import { getPreset } from "@/lib/contest-types";
import { fieldsForPhase, resolveSubmissionFields } from "@/lib/submission-fields";
import { SCOPE_RULES_CONTESTANT } from "@/lib/ai/guardrails";

export interface ContestKnowledgeInput {
  name: string;
  slug: string;
  status: string;
  contestType: string | null;
  description: string | null;
  heroSubtitle?: string | null;
  rulesContent: string | null;
  eligibilityRules: string | null;
  teamStructureRules: string | null;
  deliverableRules: string | null;
  scoringCriteria: unknown;
  phaseConfig: unknown;
  prizes: unknown;
  roleConfig: unknown;
  submissionFields: unknown;
  scoringScale: unknown;
  terminology: unknown;
  settings: unknown;
  agenda: unknown;
  speakers: unknown;
  faqConfig: unknown;
  supportEmail?: string | null;
  maxTeams: number;
  maxTeamMembers: number;
  startDate: Date | null;
  endDate: Date | null;
  registrationDeadline: Date | null;
  tracks?: Array<{ name: string; description: string | null }>;
}

type Phase = {
  phase: number;
  name: string;
  maxPoints: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  details?: string[];
  deliverables?: string[];
};
type Criterion = { name: string; key?: string; weight: number; description?: string };
type Prize = { rank?: number; label?: string; amount?: number | null };
type Role = { role: string; maxPerTeam: number };
type Faq = { question: string; answer: string };

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const clip = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : "");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return typeof v === "string" ? v : "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function range(a?: string | Date | null, b?: string | Date | null): string {
  const x = fmtDate(a);
  const y = fmtDate(b);
  if (x && y) return x === y ? x : `${x} – ${y}`;
  return x || y || "dates to be announced";
}
function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Structured, public facts about a contest (shared by the prompt and the mock). */
export function contestFacts(c: ContestKnowledgeInput) {
  const preset = getPreset(c.contestType);
  const terms = (c.terminology as Terminology | null) ?? preset.terminology;
  const settings = resolveSettings(c.settings);
  const scale = resolveScale(c.scoringScale);
  const phases = arr<Phase>(c.phaseConfig).filter((p) => p && typeof p.phase === "number");
  const criteria = arr<Criterion>(c.scoringCriteria).filter((x) => x && x.name);
  const fields = resolveSubmissionFields(c.submissionFields);
  const prizes = arr<Prize>(c.prizes);
  const roles = arr<Role>(c.roleConfig).filter((r) => r && r.role);
  const faq = arr<Faq>(c.faqConfig).filter((f) => f && f.question && f.answer);
  const agenda = arr<AgendaItem>(c.agenda).filter((a) => a && a.title);
  const speakers = arr<Speaker>(c.speakers).filter((s) => s && s.name);
  const tracks = c.tracks ?? [];
  return { preset, terms, settings, scale, phases, criteria, fields, prizes, roles, faq, agenda, speakers, tracks };
}

export function buildContestantSystemPrompt(c: ContestKnowledgeInput, today: string): string {
  const f = contestFacts(c);
  const T = (k: Parameters<typeof term>[1]) => term(f.terms, k);
  const TP = (k: Parameters<typeof termPlural>[1]) => termPlural(f.terms, k);
  const s: string[] = [];

  s.push(
    `You are the official assistant for "${c.name}", a ${f.preset.label.toLowerCase()}. You help visitors and participants understand this contest.`,
    `Today is ${today}. Contest status: ${c.status}.`,
    `Use the contest's own vocabulary: say "${T("track")}" (plural "${TP("track")}"), "${T("phase")}", "${T("judge")}", "${T("submission")}" and "${T("team")}".`,
    "Answer ONLY from the contest information below. If the answer is not there, say you don't have that information and suggest contacting the organisers" +
      (c.supportEmail ? ` at ${c.supportEmail}.` : "."),
    "Be concise and friendly. Use short bullet lists for multi-part answers. Quote exact dates, points, weights, file formats and limits from the information. Never invent dates, prizes or rules.",
    "",
    SCOPE_RULES_CONTESTANT,
    "",
    "=== CONTEST INFORMATION ===",
  );

  s.push(`\n# About\nName: ${c.name}\nType: ${f.preset.label}`);
  if (c.description) s.push(clip(c.description, 2000));
  if (f.settings.theme) s.push(`Theme: ${f.settings.theme}`);
  else if (c.heroSubtitle) s.push(`Tagline: ${c.heroSubtitle}`);

  s.push(
    `\n# Key dates`,
    `Contest runs: ${range(c.startDate, c.endDate)}`,
    `Registration deadline: ${c.registrationDeadline ? fmtDate(c.registrationDeadline) : "not announced"}`,
  );

  s.push(`\n# Teams`, `Team size: up to ${c.maxTeamMembers} members. Maximum ${c.maxTeams} teams can register.`);
  if (f.roles.length) s.push(`Team roles: ${f.roles.map((r) => `${r.role} (max ${r.maxPerTeam})`).join(", ")}`);
  if (f.settings.exclusiveTracks) s.push(`Each ${T("track").toLowerCase()} can be picked by only one ${T("team").toLowerCase()}.`);

  if (c.eligibilityRules) s.push(`\n# Eligibility\n${clip(c.eligibilityRules, 3000)}`);
  if (c.teamStructureRules) s.push(`\n# Team structure\n${clip(c.teamStructureRules, 3000)}`);
  if (c.deliverableRules) s.push(`\n# Deliverables (rules)\n${clip(c.deliverableRules, 3000)}`);
  if (c.rulesContent) s.push(`\n# Rules\n${clip(c.rulesContent, 8000)}`);

  if (f.tracks.length) {
    s.push(`\n# ${TP("track")} (${f.tracks.length})`);
    for (const t of f.tracks.slice(0, 40)) s.push(`- ${t.name}${t.description ? `: ${clip(t.description, 300)}` : ""}`);
  }

  if (f.phases.length) {
    s.push(`\n# ${TP("phase")}`);
    for (const p of f.phases) {
      const lines = [`## ${T("phase")} ${p.phase}: ${p.name} — ${p.maxPoints ? `${p.maxPoints} points` : "not scored"} — ${range(p.startDate, p.endDate)}`];
      if (p.description) lines.push(clip(p.description, 600));
      if (p.details?.length) lines.push(`Activities: ${p.details.join("; ")}`);
      if (p.deliverables?.length) lines.push(`Deliverables: ${p.deliverables.join("; ")}`);
      const pf = fieldsForPhase(f.fields, p.phase);
      if (p.maxPoints > 0 && pf.length) {
        lines.push(
          `What to submit in this ${T("phase").toLowerCase()}:\n` +
            pf
              .map((x) => {
                const bits = [x.required ? "required" : "optional", x.type];
                if (x.accept) bits.push(`formats ${x.accept}`);
                if (x.maxSizeMb) bits.push(`max ${x.maxSizeMb} MB`);
                if (x.options?.length) bits.push(`one of: ${x.options.join(", ")}`);
                const hint = x.helpText || x.placeholder;
                return `  - ${x.label} (${bits.join(", ")})${hint ? ` — ${clip(hint, 200)}` : ""}`;
              })
              .join("\n"),
        );
      }
      s.push(lines.join("\n"));
    }
  }

  if (f.criteria.length) {
    s.push(`\n# Scoring criteria (weights)`);
    for (const k of f.criteria) {
      s.push(`- ${k.name}: ${Math.round(k.weight * 100)}%${k.description ? ` — ${clip(k.description, 300)}` : ""}`);
    }
  }
  s.push(
    `\n# Scoring scale\n${T("judge")} score each criterion from ${f.scale.min} to ${f.scale.max}.` +
      (f.scale.labels?.length ? ` Rubric: ${f.scale.labels.map((l) => `${l.min}–${l.max} ${l.label}`).join(", ")}.` : ""),
  );

  if (f.prizes.length) {
    s.push(`\n# Prizes`);
    for (const p of f.prizes) s.push(`- ${p.label ?? `Rank ${p.rank}`}${p.amount ? `: ${money(p.amount)}` : " (amount to be announced)"}`);
  }

  if (f.agenda.length) {
    const byId = new Map(f.speakers.map((sp) => [sp.id, sp.name]));
    s.push(`\n# Agenda`);
    for (const a of [...f.agenda].sort((x, y) => `${x.day} ${x.start}`.localeCompare(`${y.day} ${y.start}`)).slice(0, 60)) {
      const who = (a.speakerIds ?? []).map((id) => byId.get(id)).filter(Boolean);
      s.push(
        `- ${fmtDate(a.day)} ${a.start}${a.end ? `–${a.end}` : ""}: ${a.title} (${AGENDA_KIND_LABELS[a.kind] ?? "Session"})` +
          (a.venue ? ` @ ${a.venue}` : "") +
          (who.length ? ` — ${who.join(", ")}` : ""),
      );
    }
  }

  if (f.speakers.length) {
    s.push(`\n# Speakers, ${T("judge").toLowerCase()} and mentors`);
    for (const sp of f.speakers.slice(0, 60)) {
      const where = [sp.title, sp.org].filter(Boolean).join(", ");
      s.push(`- ${sp.name}${where ? ` (${where})` : ""} — ${(sp.roles ?? []).join(", ") || "speaker"}`);
    }
  }

  if (f.faq.length) {
    s.push(`\n# FAQ`);
    for (const q of f.faq.slice(0, 40)) s.push(`Q: ${clip(q.question, 300)}\nA: ${clip(q.answer, 1200)}`);
  }
  if (c.supportEmail) s.push(`\n# Contact\nOrganisers: ${c.supportEmail}`);
  s.push("=== END OF CONTEST INFORMATION ===");
  return s.join("\n");
}

/** Keyword-based answer from the facts — used when no OpenAI key is configured. */
export function mockContestAnswer(c: ContestKnowledgeInput, question: string): string {
  const f = contestFacts(c);
  const q = question.toLowerCase();
  const T = (k: Parameters<typeof term>[1]) => term(f.terms, k);
  const TP = (k: Parameters<typeof termPlural>[1]) => termPlural(f.terms, k);
  const out: string[] = [];

  if (/criteri|scor|judg|jury|weight|mark|evaluat|point/.test(q)) {
    if (f.criteria.length)
      out.push(`**Scoring criteria**\n${f.criteria.map((k) => `• ${k.name} — ${Math.round(k.weight * 100)}%`).join("\n")}`);
    out.push(
      `Each criterion is scored ${f.scale.min}–${f.scale.max}` +
        (f.scale.labels?.length ? ` (${f.scale.labels.map((l) => `${l.min}–${l.max} ${l.label}`).join(", ")}).` : "."),
    );
  }
  if (/round|phase|timeline|date|when|deadline|schedule|stage/.test(q)) {
    out.push(`**${TP("phase")}**\n${f.phases.map((p) => `• ${T("phase")} ${p.phase}: ${p.name} — ${p.maxPoints ? `${p.maxPoints} pts` : "not scored"} (${range(p.startDate, p.endDate)})`).join("\n")}`);
    if (c.registrationDeadline) out.push(`Registration closes ${fmtDate(c.registrationDeadline)}.`);
  }
  if (/submit|deliverable|upload|format|file|deck|document/.test(q)) {
    const scored = f.phases.filter((p) => p.maxPoints > 0);
    for (const p of scored) {
      const pf = fieldsForPhase(f.fields, p.phase);
      if (pf.length) out.push(`**${T("phase")} ${p.phase} — ${p.name}**\n${pf.map((x) => `• ${x.label}${x.required || /optional/i.test(x.label) ? "" : " (optional)"}${x.accept ? ` [${x.accept}]` : ""}`).join("\n")}`);
    }
  }
  if (/categor|track|problem|theme|challenge/.test(q) && f.tracks.length) {
    out.push(`**${TP("track")}**\n${f.tracks.map((t) => `• ${t.name}`).join("\n")}`);
  }
  if (/eligib|who can|participat|join|register|team size|members|how many/.test(q)) {
    if (c.eligibilityRules) out.push(`**Eligibility**\n${c.eligibilityRules}`);
    out.push(`Teams can have up to ${c.maxTeamMembers} members.`);
  }
  if (/prize|award|win|reward/.test(q) && f.prizes.length) {
    out.push(`**Prizes**\n${f.prizes.map((p) => `• ${p.label ?? `Rank ${p.rank}`}${p.amount ? ` — ${money(p.amount)}` : ""}`).join("\n")}`);
  }
  if (/agenda|speaker|keynote|panel|session/.test(q) && (f.agenda.length || f.speakers.length)) {
    if (f.agenda.length) out.push(`**Agenda**\n${f.agenda.slice(0, 10).map((a) => `• ${fmtDate(a.day)} ${a.start} — ${a.title}`).join("\n")}`);
  }

  const header = "(mock assistant — set OPENAI_API_KEY for real answers)";
  if (out.length === 0) {
    return `${header}\n\nI can answer questions about "${c.name}": eligibility, dates, ${TP("phase").toLowerCase()}, what to submit, scoring criteria, ${TP("track").toLowerCase()} and prizes. Try one of the suggested questions.`;
  }
  return `${header}\n\n${out.join("\n\n")}`;
}
