"use client";
/**
 * AI Contest Assistant — SETUP mode.
 *
 * Contract (kept stable — mounted by the platform-admin and contest-admin pages):
 *   mode "create": platform admin describes a contest in plain words; the
 *     assistant proposes a full contest draft. onApply(draft) receives a
 *     ContestDraft (fields accepted by POST /api/contests).
 *   mode "edit": contest admin asks for changes to an existing contest;
 *     onApply(patch) receives a partial ContestDraft (fields accepted by
 *     PUT /api/contests/[slug]; `tracks` must be applied via the tracks API).
 *
 * The assistant never saves anything itself: it calls POST /api/ai/contest-setup,
 * shows a readable preview and hands the draft to the form via onApply.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Loader2, PencilLine, RotateCcw, Send, Sparkles, Wand2, X } from "lucide-react";
import { term, termPlural, type SubmissionField, type Terminology } from "@/lib/contest-config";
import { draftKeys, type ContestDraft } from "@/lib/ai/contest-draft";

export type { ContestDraft } from "@/lib/ai/contest-draft";

type ChatItem = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  hasDraft?: boolean;
};

type SetupResponse = {
  reply?: string;
  draft?: ContestDraft | null;
  warnings?: string[];
  outOfScope?: boolean;
  mock?: boolean;
  error?: string;
};

const CREATE_EXAMPLES = [
  "Business symposium for MBA students, 10 categories, finale on 7 Nov",
  "2-week AI hackathon for employees with 6 problem statements",
  "Inter-college case competition, teams of 3-4, three rounds, 1-10 jury scale",
];

const EDIT_EXAMPLES = [
  "Switch the jury scale to 1-10 with labels",
  "Add an FAQ with 5 questions about eligibility and team size",
  "Rebalance the criteria so presentation is 25%",
  "Add a keynote and a panel to the finale day agenda",
];

const TYPE_LABEL: Record<string, string> = {
  hackathon: "Hackathon",
  business_symposium: "Business Symposium",
};

const KEY_LABEL: Record<string, string> = {
  contestType: "Type",
  name: "Name",
  slug: "Slug",
  description: "Description",
  heroTitle: "Hero title",
  heroSubtitle: "Hero subtitle",
  heroCtaText: "CTA text",
  rulesContent: "Rules",
  eligibilityRules: "Eligibility",
  teamStructureRules: "Team structure",
  deliverableRules: "Deliverable rules",
  startDate: "Start date",
  endDate: "End date",
  registrationDeadline: "Registration deadline",
  maxTeams: "Max teams",
  maxApprovedTeams: "Max approved teams",
  maxTeamMembers: "Team size",
  supportEmail: "Support email",
  tracks: "Categories",
  phaseConfig: "Rounds",
  scoringCriteria: "Criteria",
  scoringScale: "Scale",
  submissionFields: "Submission fields",
  terminology: "Terminology",
  roleConfig: "Roles",
  prizes: "Prizes",
  faqConfig: "FAQ",
  agenda: "Agenda",
  speakers: "Speakers",
  settings: "Settings",
};

function fmtDate(s?: string): string {
  if (!s) return "";
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function dateRange(a?: string, b?: string): string {
  const x = fmtDate(a);
  const y = fmtDate(b);
  if (x && y) return x === y ? x : `${x} – ${y}`;
  return x || y || "";
}

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "Text",
  textarea: "Long text",
  url: "Link",
  urlList: "Links",
  file: "File",
  fileList: "Files",
  select: "Choice",
};

export function AiContestSetup({
  mode,
  contestSlug,
  onApply,
  className,
}: {
  mode: "create" | "edit";
  contestSlug?: string;
  onApply: (draft: ContestDraft) => void;
  className?: string;
}) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ContestDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const [mock, setMock] = useState(false);
  const [refining, setRefining] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const examples = mode === "create" ? CREATE_EXAMPLES : EDIT_EXAMPLES;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    if (mode === "edit" && !contestSlug) {
      setItems((p) => [...p, { role: "assistant", content: "Missing contest — cannot edit.", error: true }]);
      return;
    }
    setInput("");
    setRefining(false);
    const history = items.filter((m) => !m.error);
    const next: ChatItem[] = [...history, { role: "user", content: q }];
    setItems(next);
    setLoading(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ai/contest-setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          contestSlug,
          messages: next.map(({ role, content }) => ({ role, content })),
          draft,
        }),
        signal: ctrl.signal,
      });
      let data: SetupResponse = {};
      try {
        data = (await res.json()) as SetupResponse;
      } catch {
        // non-JSON error body
      }
      if (!res.ok) {
        setItems((p) => [...p, { role: "assistant", content: data.error ?? `Request failed (${res.status}).`, error: true }]);
        return;
      }
      setMock(!!data.mock);
      const hasDraft = !!data.draft && Object.keys(data.draft).length > 0;
      setItems((p) => [...p, { role: "assistant", content: data.reply ?? "", hasDraft }]);
      if (hasDraft) {
        setDraft(data.draft!);
        setWarnings(data.warnings ?? []);
        setApplied(false);
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setItems((p) => [...p, { role: "assistant", content: "Network error — please try again.", error: true }]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function apply() {
    if (!draft) return;
    onApply(draft);
    setApplied(true);
  }

  function refine() {
    setRefining(true);
    textRef.current?.focus();
  }

  function reset() {
    abortRef.current?.abort();
    setItems([]);
    setDraft(null);
    setWarnings([]);
    setApplied(false);
    setInput("");
    setRefining(false);
  }

  return (
    <section
      className={`overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm ${className ?? ""}`}
      aria-label="AI contest assistant"
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon-purple to-electric-blue">
            <Wand2 size={16} className="text-white" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">
              AI Contest Assistant
              {mock && (
                <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-amber-300">
                  mock
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400">
              {mode === "create"
                ? "Describe the contest in plain words — I'll draft categories, rounds, scoring and submission fields. Nothing is saved until you apply and save."
                : "Ask for changes — I'll propose a patch for you to review. Nothing is saved until you apply and save."}
            </p>
          </div>
        </div>
        {(items.length > 0 || draft) && (
          <button
            type="button"
            onClick={reset}
            title="Start over"
            className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <RotateCcw size={15} />
          </button>
        )}
      </header>

      {/* Conversation */}
      <div ref={listRef} className="max-h-72 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {items.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Try an example:</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => send(ex)}
                  disabled={loading}
                  className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-left text-xs text-purple-100 transition hover:border-purple-400/60 hover:bg-purple-500/20 disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto max-w-[85%] bg-purple-600/90 text-white"
                : m.error
                  ? "max-w-[92%] border border-red-500/30 bg-red-500/10 text-red-200"
                  : "max-w-[92%] bg-white/5 text-gray-100"
            }`}
          >
            {m.content}
            {m.hasDraft && m.role === "assistant" && (
              <span className="mt-1 block text-[11px] text-purple-300">Draft updated below.</span>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex max-w-[92%] items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-300">
            <Loader2 size={14} className="animate-spin" />
            {mode === "create" ? "Drafting your contest…" : "Working out the changes…"}
          </div>
        )}
      </div>

      {/* Draft preview */}
      {draft && (
        <div className="border-t border-white/10 px-4 py-3">
          <DraftPreview draft={draft} mode={mode} warnings={warnings} />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={apply}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-neon-purple to-electric-blue px-4 py-2 text-sm font-medium text-white shadow hover:brightness-110"
            >
              {applied ? <Check size={16} /> : <Sparkles size={16} />}
              {applied ? "Applied — apply again" : "Apply to form"}
            </button>
            <button
              type="button"
              onClick={refine}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
            >
              <PencilLine size={16} /> Refine
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setWarnings([]);
                setApplied(false);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <X size={16} /> Discard
            </button>
          </div>
          {applied && (
            <p className="mt-2 text-xs text-green-400">
              Copied into the form. Review the fields, then save{mode === "create" ? " to create the contest" : ""}.
            </p>
          )}
        </div>
      )}

      {/* Composer */}
      <form
        className="border-t border-white/10 px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={
              refining || draft
                ? "What should change? e.g. “make it 8 categories and move the finale to 14 Nov”"
                : mode === "create"
                  ? "e.g. A business symposium for MBA students with 10 categories and a finale on 7 Nov…"
                  : "e.g. Add a Sustainability category and make presentation 25%…"
            }
            aria-label="Describe the contest or the change"
            className="min-h-[44px] flex-1 resize-none rounded-md border border-white/10 bg-black/30 px-3 py-2 text-base text-white outline-none placeholder:text-gray-500 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/40 sm:text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send"
            className="rounded-md bg-purple-600 p-2.5 text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500">
          Helps with contest setup only — it won&apos;t judge teams, approve registrations or send messages.
        </p>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
        {right}
      </div>
      {children}
    </div>
  );
}

function DraftPreview({ draft, mode, warnings }: { draft: ContestDraft; mode: "create" | "edit"; warnings: string[] }) {
  const terms: Terminology = draft.terminology ?? {};
  const T = (k: Parameters<typeof term>[1]) => term(terms, k);
  const TP = (k: Parameters<typeof termPlural>[1]) => termPlural(terms, k);
  const keys = draftKeys(draft);
  const phases = draft.phaseConfig ?? [];
  const totalPoints = phases.reduce((a, p) => a + (p.maxPoints || 0), 0);
  const criteria = draft.scoringCriteria ?? [];
  const fields = draft.submissionFields ?? [];

  // Group fields per round (fields without `phases` apply to every scored round).
  const fieldGroups = (() => {
    const groups: Array<{ label: string; fields: SubmissionField[] }> = [];
    if (!fields.length) return groups;
    if (phases.length) {
      const scored = phases.filter((p) => p.maxPoints > 0);
      for (const p of scored.length ? scored : phases) {
        const fs = fields.filter((f) => !f.phases || f.phases.length === 0 || f.phases.includes(p.phase));
        if (fs.length) groups.push({ label: `${T("phase")} ${p.phase} · ${p.name}`, fields: fs });
      }
      return groups;
    }
    const nums = Array.from(new Set(fields.flatMap((f) => f.phases ?? []))).sort((a, b) => a - b);
    const all = fields.filter((f) => !f.phases || f.phases.length === 0);
    if (all.length) groups.push({ label: `Every ${T("phase").toLowerCase()}`, fields: all });
    for (const n of nums) groups.push({ label: `${T("phase")} ${n}`, fields: fields.filter((f) => f.phases?.includes(n)) });
    return groups;
  })();

  const scale = draft.scoringScale;
  const theme = typeof draft.settings?.theme === "string" ? draft.settings.theme : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-purple-300">
          {mode === "create" ? "Proposed contest" : "Proposed changes"}
        </span>
        {mode === "edit" &&
          keys.map((k) => (
            <span key={k} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-300">
              {KEY_LABEL[k] ?? k}
            </span>
          ))}
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          {warnings.map((w, i) => (
            <li key={i} className="flex gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {(draft.name || draft.contestType || draft.slug || draft.description || theme) && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {draft.contestType && (
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[11px] font-medium text-purple-200">
                {TYPE_LABEL[draft.contestType] ?? draft.contestType}
              </span>
            )}
            {draft.name && <span className="text-base font-semibold text-white">{draft.name}</span>}
          </div>
          {draft.slug && <div className="mt-1 font-mono text-xs text-gray-400">/c/{draft.slug}</div>}
          {theme && <div className="mt-1 text-xs italic text-purple-200">Theme: {theme}</div>}
          {draft.description && <p className="mt-2 line-clamp-3 text-sm text-gray-300">{draft.description}</p>}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(draft.startDate || draft.endDate || draft.registrationDeadline || draft.maxTeamMembers || draft.roleConfig) && (
          <Section title="Dates & teams">
            <dl className="space-y-1 text-sm">
              {(draft.startDate || draft.endDate) && (
                <Row k="Runs" v={dateRange(draft.startDate, draft.endDate)} />
              )}
              {draft.registrationDeadline && <Row k="Registration closes" v={fmtDate(draft.registrationDeadline)} />}
              {draft.maxTeamMembers !== undefined && <Row k={`${T("team")} size`} v={`up to ${draft.maxTeamMembers}`} />}
              {draft.maxTeams !== undefined && <Row k={`Max ${TP("team").toLowerCase()}`} v={String(draft.maxTeams)} />}
            </dl>
            {draft.roleConfig && draft.roleConfig.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.roleConfig.map((r) => (
                  <span key={r.role} className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-gray-300">
                    {r.role} ×{r.maxPerTeam}
                  </span>
                ))}
              </div>
            )}
          </Section>
        )}

        {scale && (
          <Section title="Scoring scale">
            <div className="text-sm text-white">
              {scale.min}–{scale.max}
              <span className="text-gray-400"> (step {scale.step})</span>
            </div>
            {scale.labels && scale.labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {scale.labels.map((l) => (
                  <span key={`${l.min}-${l.label}`} className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-gray-300">
                    {l.min === l.max ? l.min : `${l.min}–${l.max}`} {l.label}
                  </span>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>

      {draft.tracks && (
        <Section title={`${TP("track")} (${draft.tracks.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {draft.tracks.map((t) => (
              <span
                key={t.name}
                title={t.description}
                className="rounded-full border border-purple-400/20 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-100"
              >
                {t.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {phases.length > 0 && (
        <Section
          title={TP("phase")}
          right={
            <span className={`text-[11px] ${totalPoints === 100 ? "text-green-400" : "text-amber-300"}`}>{totalPoints} pts total</span>
          }
        >
          <ol className="space-y-1.5">
            {phases.map((p) => (
              <li key={p.phase} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <span className="text-sm text-white">
                  <span className="mr-1.5 text-gray-500">{p.phase}.</span>
                  {p.name}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {p.maxPoints ? `${p.maxPoints} pts` : "not scored"}
                  {dateRange(p.startDate, p.endDate) && ` · ${dateRange(p.startDate, p.endDate)}`}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {criteria.length > 0 && (
        <Section title="Scoring criteria">
          <ul className="space-y-2">
            {criteria.map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-gray-100">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-purple-200">{Math.round(c.weight * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon-purple to-electric-blue"
                    style={{ width: `${Math.min(100, Math.round(c.weight * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {fieldGroups.length > 0 && (
        <Section title={`What ${TP("team").toLowerCase()} submit`}>
          <div className="space-y-3">
            {fieldGroups.map((g) => (
              <div key={g.label}>
                <div className="mb-1 text-xs font-medium text-gray-300">{g.label}</div>
                <ul className="flex flex-wrap gap-1.5">
                  {g.fields.map((f) => (
                    <li
                      key={f.key}
                      title={[f.helpText, f.accept, f.maxSizeMb ? `max ${f.maxSizeMb} MB` : ""].filter(Boolean).join(" · ")}
                      className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-200"
                    >
                      {f.label}
                      {f.required && <span className="text-purple-300">*</span>}
                      <span className="ml-1 text-gray-500">{FIELD_TYPE_LABEL[f.type] ?? f.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(draft.prizes || draft.faqConfig || draft.agenda || draft.speakers || draft.terminology || hasRules(draft)) && (
        <Section title="Also included">
          <ul className="space-y-1 text-xs text-gray-300">
            {draft.prizes && draft.prizes.length > 0 && (
              <li>
                Prizes: {draft.prizes.map((p) => (p.amount ? `${p.label} (₹${p.amount.toLocaleString("en-IN")})` : p.label)).join(", ")}
              </li>
            )}
            {draft.terminology && Object.keys(draft.terminology).length > 0 && (
              <li>
                Vocabulary: {T("track")} · {T("phase")} · {T("judge")} · {T("submission")}
              </li>
            )}
            {hasRules(draft) && (
              <li>
                Rules text:{" "}
                {[
                  draft.eligibilityRules && "eligibility",
                  draft.teamStructureRules && "team structure",
                  draft.deliverableRules && "deliverables",
                  draft.rulesContent && "general rules",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </li>
            )}
            {draft.faqConfig && <li>FAQ: {draft.faqConfig.length} question(s)</li>}
            {draft.agenda && <li>Agenda: {draft.agenda.length} session(s)</li>}
            {draft.speakers && (
              <li>
                Speakers / {T("judge").toLowerCase()}: {draft.speakers.map((s) => s.name).join(", ") || "none"}
              </li>
            )}
          </ul>
        </Section>
      )}
    </div>
  );
}

function hasRules(d: ContestDraft): boolean {
  return !!(d.eligibilityRules || d.teamStructureRules || d.deliverableRules || d.rulesContent);
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-400">{k}</dt>
      <dd className="text-right text-gray-100">{v}</dd>
    </div>
  );
}
