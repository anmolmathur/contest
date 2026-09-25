"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, ClipboardCheck, Flag, Gavel, Lightbulb, Plus, Save, Trash2, XCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { useContest, useContestConfig } from "@/lib/contest-context";
import type { ProblemWithClaims } from "@/lib/problems";
import type { ContestAward } from "@/lib/contest-types";
import type { ImpactMetric } from "@/lib/impact";

const inputCls = "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500";
type TeamRow = { id: string; name: string; approved: boolean; status?: string };
type Decision = { teamId: string; phase: number; decision: string; conditions: string | null };

/**
 * Admin "Ideathon Ops" tab: Problem Bank moderation, gate decisions overview,
 * Auditor queue counts and category-award winners.
 */
export function IdeathonAdminPanel() {
  const { contest } = useContest();
  const { t, tp } = useContestConfig();
  const slug = contest.slug;
  const [problems, setProblems] = useState<ProblemWithClaims[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [metrics, setMetrics] = useState<ImpactMetric[]>([]);
  const [awards, setAwards] = useState<ContestAward[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchAll = useCallback(async () => {
    const [p, tm, d, m, a] = await Promise.all([
      fetch(`/api/c/${slug}/problems`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/c/${slug}/teams/all`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/c/${slug}/stage-decisions`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/c/${slug}/metrics`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/c/${slug}/awards`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    return {
      problems: (p.problems ?? []) as ProblemWithClaims[],
      teams: (tm.teams ?? []) as TeamRow[],
      decisions: (d.decisions ?? []) as Decision[],
      metrics: (m.metrics ?? []) as ImpactMetric[],
      awards: ((a.awards ?? []) as Array<ContestAward & { winnerTeamName?: string }>).map((aw) => ({
        key: aw.key,
        label: aw.label,
        description: aw.description,
        amount: aw.amount,
        winnerTeamId: aw.winnerTeamId ?? null,
      })),
    };
  }, [slug]);
  const apply = useCallback((r: Awaited<ReturnType<typeof fetchAll>>) => {
    setProblems(r.problems);
    setTeams(r.teams);
    setDecisions(r.decisions);
    setMetrics(r.metrics);
    setAwards(r.awards);
  }, []);
  const load = useCallback(async () => apply(await fetchAll()), [fetchAll, apply]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAll();
      if (!cancelled) apply(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAll, apply]);

  const flash = (ok: boolean, text: string) => setMsg({ ok, text });

  const patchProblem = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/c/${slug}/problems/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    flash(res.ok, res.ok ? "Problem updated." : data.error ?? "Failed");
    await load();
  };
  const deleteProblem = async (id: string) => {
    if (!confirm("Delete this problem? Teams that claimed it will be unassigned.")) return;
    await fetch(`/api/c/${slug}/problems/${id}`, { method: "DELETE" });
    await load();
  };
  const saveAwards = async () => {
    const res = await fetch(`/api/c/${slug}/awards`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ awards }),
    });
    const data = await res.json().catch(() => ({}));
    flash(res.ok, res.ok ? "Awards saved." : data.error ?? "Failed");
    if (res.ok) await load();
  };

  const gates = (contest.phaseConfig ?? []).filter((p) => p.gate);
  const approvedTeams = teams.filter((tm) => tm.approved);
  const proposals = problems.filter((p) => p.status === "proposed");
  const bank = problems.filter((p) => p.status !== "proposed");
  const queue = useMemo(
    () => ({
      baseline: metrics.filter((m) => m.baselineStatus === "submitted").length,
      actual: metrics.filter((m) => m.actualStatus === "submitted").length,
      finance: metrics.filter((m) => m.actualStatus === "validated" && m.financeStatus !== "validated").length,
    }),
    [metrics],
  );

  return (
    <div className="space-y-8">
      {msg && (
        <div className={`rounded-lg border px-4 py-2 text-sm ${msg.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-red-500/40 bg-red-500/10 text-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Auditor queue */}
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="text-emerald-300" />
          <h3 className="text-xl font-bold text-white">{t("validator")} queue</h3>
          <Link href={`/c/${slug}/validate`} className="ml-auto text-sm text-electric-blue hover:underline">
            Open the {t("validator")} desk →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "Baselines waiting", v: queue.baseline },
            { k: "Actuals waiting", v: queue.actual },
            { k: "Waiting for Finance", v: queue.finance },
          ].map((x) => (
            <div key={x.k} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-2xl font-black text-white">{x.v}</div>
              <div className="text-xs text-gray-400">{x.k}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Add {t("validator")}s in the Users tab (role “{t("validator")}”, scope Data or Finance).
        </p>
      </GlassCard>

      {/* Gate decisions */}
      {gates.map((g) => {
        const forGate = decisions.filter((d) => d.phase === g.phase);
        const count = (k: string) => forGate.filter((d) => d.decision === k).length;
        return (
          <GlassCard key={g.phase} className="p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Gavel className="text-amber-300" />
              <h3 className="text-xl font-bold text-white">{g.name}: decisions</h3>
              <span className="text-sm text-gray-400">
                {count("go")} Go · {count("conditional")} Go-with-changes · {count("out")} Out · {approvedTeams.length - forGate.length} pending
              </span>
              <Link href={`/c/${slug}/judging`} className="ml-auto text-sm text-electric-blue hover:underline">
                Decide in {t("judge")} scoring →
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {approvedTeams.map((tm) => {
                const d = forGate.find((x) => x.teamId === tm.id);
                return (
                  <div key={tm.id} className="flex flex-wrap items-start gap-3 py-2 text-sm">
                    <span className="min-w-[10rem] font-semibold text-white">{tm.name}</span>
                    {!d ? (
                      <span className="text-gray-500">pending</span>
                    ) : d.decision === "go" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 size={14} /> Go
                      </span>
                    ) : d.decision === "conditional" ? (
                      <span className="inline-flex items-center gap-1 text-amber-200">
                        <Flag size={14} /> Go with changes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-300">
                        <XCircle size={14} /> Out
                      </span>
                    )}
                    {d?.conditions && <span className="flex-1 text-xs text-gray-400">{d.conditions}</span>}
                  </div>
                );
              })}
              {approvedTeams.length === 0 && <p className="py-2 text-gray-400">No approved {tp("team").toLowerCase()} yet.</p>}
            </div>
          </GlassCard>
        );
      })}

      {/* Problem Bank */}
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="text-amber-300" />
          <h3 className="text-xl font-bold text-white">Problem Bank</h3>
          <Link href={`/c/${slug}/problems`} className="ml-auto text-sm text-electric-blue hover:underline">
            Public view →
          </Link>
        </div>

        {proposals.length > 0 && (
          <div className="mb-6">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-amber-200">Proposals to review ({proposals.length})</h4>
            <div className="space-y-2">
              {proposals.map((p) => (
                <div key={p.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{p.title}</span>
                    <span className="text-xs text-gray-400">by {p.proposedByTeamName ?? "a team"}</span>
                    <span className="ml-auto flex gap-2">
                      <button onClick={() => patchProblem(p.id, { status: "approved" })} className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-black">
                        Approve
                      </button>
                      <button onClick={() => patchProblem(p.id, { status: "rejected" })} className="rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-200">
                        Reject
                      </button>
                    </span>
                  </div>
                  {p.description && <p className="mt-1 text-sm text-gray-300">{p.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <AddProblem slug={slug} tracks={contest.tracks} lensWord={t("track")} onAdded={load} />

        <div className="mt-4 divide-y divide-white/5">
          {bank.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="flex-1 min-w-[14rem] text-white">
                {p.title}
                <span className="ml-2 text-xs text-gray-500">
                  {contest.tracks.find((tr) => tr.id === p.trackId)?.name ?? "—"} · {p.status} · {p.claimedBy.map((c) => c.name).join(", ") || "unclaimed"}
                </span>
              </span>
              <label className="flex items-center gap-1 text-xs text-gray-400">
                Max {tp("team").toLowerCase()}
                <input
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={p.maxTeams}
                  onBlur={(e) => Number(e.target.value) !== p.maxTeams && patchProblem(p.id, { maxTeams: Number(e.target.value) })}
                  className="w-14 rounded border border-white/15 bg-white/5 px-1 py-0.5 text-white"
                />
              </label>
              <button
                onClick={() => patchProblem(p.id, { status: p.status === "closed" ? "open" : "closed" })}
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-gray-200 hover:bg-white/10"
              >
                {p.status === "closed" ? "Re-open" : "Close"}
              </button>
              <button onClick={() => deleteProblem(p.id)} className="rounded p-1 text-gray-400 hover:bg-white/10" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Awards */}
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Award className="text-amber-300" />
          <h3 className="text-xl font-bold text-white">Category awards</h3>
          <button onClick={saveAwards} className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black">
            <Save size={14} /> Save awards
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Winners stay hidden from the public until you publish results. A {t("team").toLowerCase()} can win at most one category award (on top of its rank).
        </p>
        <div className="space-y-2">
          {awards.map((a, i) => (
            <div key={a.key} className="grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-[1fr_2fr_8rem_14rem_auto]">
              <input className={inputCls} value={a.label} onChange={(e) => setAwards((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input
                className={inputCls}
                value={a.description}
                onChange={(e) => setAwards((l) => l.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
              />
              <input
                className={inputCls}
                inputMode="numeric"
                value={a.amount ?? ""}
                placeholder="₹"
                onChange={(e) =>
                  setAwards((l) => l.map((x, j) => (j === i ? { ...x, amount: e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")) } : x)))
                }
              />
              <select
                className={inputCls}
                value={a.winnerTeamId ?? ""}
                onChange={(e) => setAwards((l) => l.map((x, j) => (j === i ? { ...x, winnerTeamId: e.target.value || null } : x)))}
              >
                <option value="" className="bg-gray-900">
                  No winner yet
                </option>
                {approvedTeams
                  .filter((tm) => tm.status !== "eliminated")
                  .map((tm) => (
                    <option key={tm.id} value={tm.id} className="bg-gray-900">
                      {tm.name}
                    </option>
                  ))}
              </select>
              <button onClick={() => setAwards((l) => l.filter((_, j) => j !== i))} className="rounded p-2 text-gray-400 hover:bg-white/10" title="Remove award">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setAwards((l) => [...l, { key: `award-${Date.now()}`, label: "New award", description: "", amount: null, winnerTeamId: null }])}
            className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            <Plus size={14} /> Add award
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

function AddProblem({
  slug,
  tracks,
  lensWord,
  onAdded,
}: {
  slug: string;
  tracks: Array<{ id: string; name: string }>;
  lensWord: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", trackId: tracks[0]?.id ?? "", ownerDepartment: "", metric: "", unit: "", direction: "decrease", maxTeams: "2" });
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr("");
    const res = await fetch(`/api/c/${slug}/problems`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.title,
        description: f.description,
        trackId: f.trackId || null,
        ownerDepartment: f.ownerDepartment,
        maxTeams: Number(f.maxTeams) || 1,
        metricTemplate: f.metric ? { metric: f.metric, unit: f.unit, direction: f.direction } : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(data.error ?? "Failed");
    setOpen(false);
    setF({ ...f, title: "", description: "", metric: "", unit: "" });
    onAdded();
  };
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10">
        <Plus size={14} /> Add problem
      </button>
    );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-2">
      <input className={`${inputCls} md:col-span-2`} placeholder="Outcome (e.g. Cut admission TAT from X to Y days)" value={f.title} onChange={set("title")} />
      <textarea className={`${inputCls} md:col-span-2`} rows={2} placeholder="Description" value={f.description} onChange={set("description")} />
      <select className={inputCls} value={f.trackId} onChange={set("trackId")}>
        {tracks.map((tr) => (
          <option key={tr.id} value={tr.id} className="bg-gray-900">
            {lensWord}: {tr.name}
          </option>
        ))}
      </select>
      <input className={inputCls} placeholder="Owning department" value={f.ownerDepartment} onChange={set("ownerDepartment")} />
      <input className={inputCls} placeholder="Metric" value={f.metric} onChange={set("metric")} />
      <div className="grid grid-cols-3 gap-2">
        <input className={inputCls} placeholder="Unit" value={f.unit} onChange={set("unit")} />
        <select className={inputCls} value={f.direction} onChange={set("direction")}>
          <option value="decrease" className="bg-gray-900">Lower ↓</option>
          <option value="increase" className="bg-gray-900">Higher ↑</option>
        </select>
        <input className={inputCls} placeholder="Max teams" value={f.maxTeams} onChange={set("maxTeams")} />
      </div>
      {err && <p className="text-sm text-red-300 md:col-span-2">{err}</p>}
      <div className="flex justify-end gap-2 md:col-span-2">
        <button onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10">
          Cancel
        </button>
        <button onClick={submit} className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black">
          Add
        </button>
      </div>
    </div>
  );
}
