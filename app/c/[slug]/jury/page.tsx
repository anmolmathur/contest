"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, FileText, Gavel, Loader2, Lock, Timer, Unlock } from "lucide-react";
import BackgroundPattern from "@/components/BackgroundPattern";
import { CriterionInput } from "@/components/scoring/CriterionInput";
import { SubmissionView } from "@/components/submissions/SubmissionView";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { scaleDefault, scaleLabelFor } from "@/lib/contest-config";
import { calculateWeightedScore, criteriaForPhase } from "@/lib/scoring";
import { formatClock, remainingSeconds, useLive, useMyRole, useNow } from "@/components/live/useLive";

interface MyScore {
  criteriaScores: Record<string, number>;
  feedback: string;
}

export default function JuryPage() {
  const { contest } = useContest();
  const { t } = useContestConfig();
  const role = useMyRole(contest.slug);

  if (role === null) {
    return (
      <main className="min-h-screen">
        <BackgroundPattern />
        <div className="py-32 text-center text-gray-400">Checking access…</div>
      </main>
    );
  }
  if (role !== "judge" && role !== "admin") {
    return (
      <main className="min-h-screen">
        <BackgroundPattern />
        <div className="mx-4 mt-24 rounded-2xl border border-white/10 bg-white/5 p-8 text-center sm:mx-auto sm:max-w-md">
          <Lock className="mx-auto mb-3 text-gray-500" size={36} />
          <h1 className="text-lg font-bold text-white">This console is for the {t("judge").toLowerCase()}</h1>
          <p className="mt-2 text-sm text-gray-400">
            Follow the pitches on the{" "}
            <Link href={`/c/${contest.slug}/stage`} className="text-electric-blue underline">
              stage screen
            </Link>{" "}
            instead.
          </p>
        </div>
      </main>
    );
  }
  return <JuryConsole />;
}

function JuryConsole() {
  const { contest } = useContest();
  const { t, scale, submissionFields } = useContestConfig();
  const slug = contest.slug;
  const { data, error, offset } = useLive(slug, 2500);
  const livePhase = data?.phase?.phase ?? null;
  const criteria = useMemo(
    () => criteriaForPhase(contest.scoringCriteria ?? [], livePhase),
    [contest.scoringCriteria, livePhase],
  );
  const now = useNow(offset, 500);

  const [mine, setMine] = useState<Record<string, MyScore>>({});
  const [drafts, setDrafts] = useState<Record<string, Record<string, number>>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const current = data?.current ?? null;
  const submissionId = current?.submissionId ?? null;
  const scoringOpen = !!data?.state.scoringOpen;

  // My existing scores (to show "Scored ✓" and prefill on revisit). The
  // response shape is {scores: [{submissionId, criteriaScores, feedback?}]};
  // read it defensively since the endpoint is shared with the judging UI.
  const loadMine = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${slug}/scores/all?judgeOnly=true`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { scores?: unknown } | unknown[];
      const list = (Array.isArray(json) ? json : Array.isArray((json as { scores?: unknown }).scores) ? (json as { scores: unknown[] }).scores : []) as Array<
        Record<string, unknown>
      >;
      const map: Record<string, MyScore> = {};
      for (const row of list) {
        const sid = typeof row.submissionId === "string" ? row.submissionId : null;
        if (!sid) continue;
        const cs = (row.criteriaScores && typeof row.criteriaScores === "object" ? row.criteriaScores : {}) as Record<string, unknown>;
        const nums: Record<string, number> = {};
        for (const [k, v] of Object.entries(cs)) if (typeof v === "number") nums[k] = v;
        map[sid] = { criteriaScores: nums, feedback: typeof row.feedback === "string" ? row.feedback : "" };
      }
      setMine(map);
    } catch {
      /* non-fatal: we just can't show the ✓ */
    }
  }, [slug]);

  useEffect(() => {
    void loadMine();
  }, [loadMine, submissionId]);

  const defaults = useMemo(() => {
    const d: Record<string, number> = {};
    for (const c of criteria) d[c.key] = scaleDefault(scale);
    return d;
  }, [criteria, scale]);

  const existing = submissionId ? mine[submissionId] : undefined;
  const values: Record<string, number> = {
    ...defaults,
    ...(existing?.criteriaScores ?? {}),
    ...(submissionId ? drafts[submissionId] ?? {} : {}),
  };
  const feedback = submissionId ? feedbackDrafts[submissionId] ?? existing?.feedback ?? "" : "";
  const weighted = calculateWeightedScore(values, criteria, scale);
  const touched = !!(submissionId && drafts[submissionId]);

  const setScore = (key: string, v: number) => {
    if (!submissionId) return;
    setMessage(null);
    setDrafts((d) => ({ ...d, [submissionId]: { ...(d[submissionId] ?? {}), [key]: v } }));
  };

  const submit = async () => {
    if (!submissionId || !scoringOpen) return;
    setSubmitting(true);
    setMessage(null);
    const criteriaScores: Record<string, number> = {};
    for (const c of criteria) criteriaScores[c.key] = values[c.key];
    try {
      const res = await fetch(`/api/c/${slug}/scores/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, criteriaScores, feedback }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: json.error ?? `Could not submit (${res.status})` });
        return;
      }
      setMine((m) => ({ ...m, [submissionId]: { criteriaScores, feedback } }));
      setDrafts((d) => {
        const n = { ...d };
        delete n[submissionId];
        return n;
      });
      setMessage({ ok: true, text: existing ? "Score updated" : "Score submitted" });
    } catch {
      setMessage({ ok: false, text: "Network error — please try again" });
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = remainingSeconds(data?.state.timerEndsAt ?? null, now);
  const fileLinks = useMemo(() => {
    const vals = current?.values ?? {};
    const out: Array<{ label: string; url: string }> = [];
    for (const f of submissionFields) {
      if (f.type !== "file" && f.type !== "fileList" && !/deck|video|prototype|demo/i.test(f.key)) continue;
      const v = vals[f.key];
      const urls = (Array.isArray(v) ? v : v ? [v] : []).filter(
        (u) => /^(https?:\/\/|\/)/.test(u) && !/\.(png|jpe?g|gif|webp)(\?|$)/i.test(u),
      );
      urls.forEach((url, i) => out.push({ label: urls.length > 1 ? `${f.label} ${i + 1}` : f.label, url }));
    }
    return out;
  }, [current?.values, submissionFields]);

  const phaseMax = data?.phase?.maxPoints ?? 0;
  const upNext = useMemo(() => {
    if (!data) return [];
    const idx = data.current ? data.queue.findIndex((q) => q.teamId === data.current!.teamId) : -1;
    return data.queue.slice(idx + 1, idx + 4);
  }, [data]);

  return (
    <main className="min-h-screen pb-40 text-white">
      <BackgroundPattern />

      {/* Sticky status header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#07070c]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              <Gavel size={12} /> {t("judge")} console
              {data?.phase && <span className="truncate normal-case tracking-normal text-gray-500">· {data.phase.name}</span>}
            </div>
            <div className="truncate text-sm font-bold">{current ? current.teamName : "Waiting…"}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {remaining !== null && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-sm font-bold tabular-nums ${
                  remaining === 0 ? "bg-red-500/20 text-red-300" : remaining <= 60 ? "bg-amber-500/20 text-amber-200" : "bg-white/10"
                }`}
              >
                <Timer size={13} /> {formatClock(remaining)}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                scoringOpen ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-gray-400"
              }`}
            >
              {scoringOpen ? <Unlock size={12} /> : <Lock size={12} />}
              {scoringOpen ? "Open" : "Closed"}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {error && !data && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>
        )}

        {!data ? (
          <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
            <Loader2 className="animate-spin" size={18} /> Connecting to the live feed…
          </div>
        ) : !current ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <Gavel size={36} className="mx-auto mb-3 text-gray-500" />
            <h1 className="text-xl font-bold">Waiting for the next {t("team").toLowerCase()}</h1>
            <p className="mt-1 text-sm text-gray-400">This screen updates automatically when the host puts a {t("team").toLowerCase()} on stage.</p>
            {upNext.length > 0 && (
              <div className="mt-6 text-left">
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Up next</div>
                <ol className="space-y-1">
                  {upNext.map((q, i) => (
                    <li key={q.teamId} className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm">
                      <span className="text-gray-500">{i + 1}.</span>
                      <span className="truncate font-semibold">{q.teamName}</span>
                      {q.track && <span className="ml-auto truncate text-xs text-gray-500">{q.track}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Team card */}
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
              <div className="h-1 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {current.track && <div className="text-xs font-semibold text-electric-blue">{current.track}</div>}
                    <h1 className="break-words text-2xl font-black sm:text-3xl">{current.teamName}</h1>
                  </div>
                  {existing && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200">
                      <CheckCircle2 size={13} /> Scored
                    </span>
                  )}
                </div>
                {current.headline && <p className="mt-3 text-sm leading-relaxed text-gray-300">{current.headline}</p>}

                {fileLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {fileLinks.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-electric-blue/40 bg-electric-blue/15 px-3 py-2 text-sm font-semibold text-blue-100 hover:bg-electric-blue/25"
                      >
                        <FileText size={14} className="shrink-0" /> <span className="truncate">{l.label}</span>
                      </a>
                    ))}
                  </div>
                )}

                {current.values && Object.keys(current.values).length > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowDetails((s) => !s)}
                      aria-expanded={showDetails}
                      className="flex w-full items-center justify-between text-sm font-semibold text-gray-300"
                    >
                      {t("submission")} details
                      <ChevronDown size={16} className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
                    </button>
                    {showDetails && (
                      <div className="mt-3">
                        <SubmissionView fields={submissionFields} values={current.values} compact />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {!scoringOpen && (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
                <Lock size={16} className="shrink-0 text-gray-500" />
                Scoring opens when the host says so — you can read the {t("submission").toLowerCase()} meanwhile.
              </div>
            )}

            {/* Criteria */}
            {criteria.length === 0 ? (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                No scoring criteria are configured for this contest.
              </div>
            ) : (
              <section className="space-y-3">
                {criteria.map((c) => {
                  const v = values[c.key];
                  const label = scaleLabelFor(scale, v);
                  return (
                    <div key={c.key} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold">{c.name}</div>
                          {c.description && <p className="mt-0.5 text-xs text-gray-400">{c.description}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[11px] text-gray-500">{Math.round(c.weight * 100)}%</div>
                          <div className="text-lg font-black tabular-nums">
                            {v}
                            {label && <span className="ml-1 text-xs font-medium text-gray-400">{label}</span>}
                          </div>
                        </div>
                      </div>
                      <CriterionInput scale={scale} value={v} onChange={(n) => setScore(c.key, n)} disabled={!scoringOpen || submitting} size="lg" />
                    </div>
                  );
                })}

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <label htmlFor="jury-feedback" className="font-bold">
                    Feedback to {t("team").toLowerCase()}
                  </label>
                  <p className="mb-2 text-xs text-gray-400">Shared with the {t("team").toLowerCase()} once results are published.</p>
                  <textarea
                    id="jury-feedback"
                    rows={4}
                    value={feedback}
                    disabled={submitting}
                    onChange={(e) => {
                      if (!submissionId) return;
                      const val = e.target.value;
                      setFeedbackDrafts((f) => ({ ...f, [submissionId]: val }));
                    }}
                    placeholder="Strengths, gaps, and one thing to improve…"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-neon-purple/60 focus:outline-none disabled:opacity-60"
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Sticky submit bar */}
      {current && criteria.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#07070c]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-gray-400">Your weighted score</div>
              <div className="text-xl font-black tabular-nums">
                {weighted.toFixed(1)}
                <span className="text-sm font-medium text-gray-500">/100</span>
                {phaseMax > 0 && (
                  <span className="ml-2 text-xs font-medium text-gray-400">
                    ≈ {((weighted / 100) * phaseMax).toFixed(1)} of {phaseMax} pts
                  </span>
                )}
              </div>
            </div>
            <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                onClick={submit}
                disabled={!scoringOpen || submitting || !submissionId || (!!existing && !touched && feedback === (existing?.feedback ?? ""))}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-purple to-electric-blue px-5 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : existing ? <CheckCircle2 size={16} /> : <Gavel size={16} />}
                {existing ? (touched || feedback !== existing.feedback ? "Update score" : "Scored ✓") : "Submit score"}
              </button>
            </div>
          </div>
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mx-auto max-w-3xl px-4 pb-2 text-center text-xs font-semibold ${message.ok ? "text-emerald-300" : "text-red-300"}`}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
