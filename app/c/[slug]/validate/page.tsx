"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, IndianRupee, Paperclip, XCircle } from "lucide-react";
import BackgroundPattern from "@/components/BackgroundPattern";
import GlassCard from "@/components/GlassCard";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { useMyMembership } from "@/lib/use-my-membership";
import { formatInr, formatMetricValue, improvementPct, totalValueInr, type ImpactMetric } from "@/lib/impact";

type Row = ImpactMetric & { teamName: string };
type Tab = "baseline" | "actual" | "finance" | "done";

const inputCls = "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500";

/**
 * Auditor queue: Data Auditors validate baselines and actuals; Finance
 * Auditors value validated results (realised ₹ + recurring ₹/yr). Admins see all.
 */
export default function ValidatePage() {
  const { contest } = useContest();
  const { t } = useContestConfig();
  const slug = contest.slug;
  const { me, status } = useMyMembership(slug);
  const [rows, setRows] = useState<Row[]>([]);
  const [tabChoice, setTab] = useState<Tab | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const scope = me?.role === "admin" ? "All" : me?.role === "validator" ? me.participantRole || "All" : null;
  const tab: Tab = tabChoice ?? (scope === "Finance" ? "finance" : "baseline");
  const fetchRows = useCallback(async (): Promise<Row[] | null> => {
    const res = await fetch(`/api/c/${slug}/metrics`, { cache: "no-store" });
    return res.ok ? (((await res.json()).metrics ?? []) as Row[]) : null;
  }, [slug]);
  const load = useCallback(async () => {
    const r = await fetchRows();
    if (r) setRows(r);
  }, [fetchRows]);
  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    (async () => {
      const r = await fetchRows();
      if (r && !cancelled) setRows(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, fetchRows]);

  const lists = useMemo(
    () => ({
      baseline: rows.filter((r) => r.baselineStatus === "submitted"),
      actual: rows.filter((r) => r.actualStatus === "submitted"),
      finance: rows.filter((r) => r.actualStatus === "validated" && r.financeStatus !== "validated"),
      done: rows.filter((r) => r.financeStatus === "validated"),
    }),
    [rows],
  );

  const review = async (id: string, body: Record<string, unknown>) => {
    setMsg(null);
    const res = await fetch(`/api/c/${slug}/metrics/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: data.error ?? "Failed" });
    await load();
  };

  if (status === "loading") return <main className="min-h-screen p-10 text-gray-400">Loading…</main>;
  if (!scope) {
    return (
      <main className="min-h-screen p-10">
        <BackgroundPattern />
        <p className="text-gray-300">This page is for {t("validator")}s and organisers.</p>
      </main>
    );
  }

  const tabs: Array<{ key: Tab; label: string; show: boolean }> = [
    { key: "baseline", label: `Baselines (${lists.baseline.length})`, show: scope !== "Finance" },
    { key: "actual", label: `Actuals (${lists.actual.length})`, show: scope !== "Finance" },
    { key: "finance", label: `Valuation (${lists.finance.length})`, show: scope !== "Data" },
    { key: "done", label: `Valued (${lists.done.length})`, show: true },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden">
      <BackgroundPattern />
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-14">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-300">
          <ClipboardCheck size={14} className="text-emerald-300" /> {t("validator")} desk{scope !== "All" ? ` · ${scope}` : ""}
        </div>
        <h1 className="text-3xl font-black text-white sm:text-4xl">Validate the numbers</h1>
        <p className="mt-2 max-w-3xl text-gray-300">
          Check each number against its source system and evidence. Validate it, or send it back with a note on what to
          fix. Only validated numbers reach the {t("judge").toLowerCase()} and the leaderboard of value.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {tabs
            .filter((x) => x.show)
            .map((x) => (
              <button
                key={x.key}
                onClick={() => setTab(x.key)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  tab === x.key ? "border-white/40 bg-white/15 text-white" : "border-white/15 text-gray-300 hover:bg-white/5"
                }`}
              >
                {x.label}
              </button>
            ))}
        </div>
        {msg && (
          <p className={`mt-4 text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>
        )}
        <div className="mt-5 space-y-4">
          {lists[tab].length === 0 && <p className="text-gray-400">Nothing waiting here.</p>}
          {lists[tab].map((m) => (
            <ReviewCard key={m.id} m={m} tab={tab} onReview={review} />
          ))}
        </div>
      </section>
    </main>
  );
}

function Evidence({ urls }: { urls: string[] | null }) {
  if (!urls?.length) return <span className="text-xs text-red-300">No evidence attached</span>;
  return (
    <span className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-electric-blue hover:underline">
          <Paperclip size={11} /> Evidence {i + 1}
        </a>
      ))}
    </span>
  );
}

function ReviewCard({
  m,
  tab,
  onReview,
}: {
  m: Row;
  tab: Tab;
  onReview: (id: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [realised, setRealised] = useState(m.realisedValueInr?.toString() ?? "");
  const [recurring, setRecurring] = useState(m.recurringAnnualValueInr?.toString() ?? "");
  const [years, setYears] = useState(String(m.recurringYears ?? 1));
  const [basis, setBasis] = useState(m.valuationBasis ?? "");
  const [busy, setBusy] = useState(false);
  const pct = improvementPct(m);

  const act = async (decision: "validated" | "rejected") => {
    setBusy(true);
    try {
      if (tab === "finance") {
        await onReview(m.id, {
          target: "finance",
          decision,
          note,
          realisedValueInr: realised,
          recurringAnnualValueInr: recurring,
          recurringYears: years,
          valuationBasis: basis,
        });
      } else {
        await onReview(m.id, { target: tab, decision, note });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs uppercase tracking-wider text-gray-400">{m.teamName}</span>
        <span className="text-lg font-bold text-white">{m.name}</span>
        <span className="text-xs text-gray-400">
          {m.direction === "decrease" ? "lower is better" : "higher is better"}
          {m.sourceSystem ? ` · source: ${m.sourceSystem}` : ""}
        </span>
      </div>
      {m.method && <p className="mt-1 text-sm text-gray-300">Method: {m.method}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-gray-400">Baseline · {m.baselinePeriod ?? "—"}</div>
          <div className="text-xl font-bold text-white">{formatMetricValue(m.baselineValue, m.unit)}</div>
          <Evidence urls={m.baselineEvidence} />
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-gray-400">Target</div>
          <div className="text-xl font-bold text-white">{formatMetricValue(m.targetValue, m.unit)}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-gray-400">Actual · {m.actualPeriod ?? "—"}</div>
          <div className="text-xl font-bold text-white">{formatMetricValue(m.actualValue, m.unit)}</div>
          {m.actualValue !== null && <Evidence urls={m.actualEvidence} />}
          {pct !== null && (
            <div className={`text-xs ${pct >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {tab === "done" ? (
        <p className="mt-3 text-sm text-gray-200">
          {formatInr(m.realisedValueInr)} realised + {formatInr(m.recurringAnnualValueInr)}/yr × {m.recurringYears ?? 1} ={" "}
          <strong className="text-emerald-300">{formatInr(totalValueInr(m))}</strong>
          {m.valuationBasis && <span className="block text-xs text-gray-400">Basis: {m.valuationBasis}</span>}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {tab === "finance" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-gray-300">Realised in live run (₹)</label>
                <input value={realised} onChange={(e) => setRealised(e.target.value)} inputMode="numeric" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Recurring per year (₹)</label>
                <input value={recurring} onChange={(e) => setRecurring(e.target.value)} inputMode="numeric" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Years (max 3)</label>
                <select value={years} onChange={(e) => setYears(e.target.value)} className={inputCls}>
                  {[0, 1, 2, 3].map((y) => (
                    <option key={y} value={y} className="bg-gray-900">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end text-sm text-gray-300">
                <IndianRupee size={14} className="mr-1" /> Total:{" "}
                <strong className="ml-1 text-emerald-300">
                  {formatInr((Number(realised) || 0) + (Number(recurring) || 0) * Number(years))}
                </strong>
              </div>
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs text-gray-300">Valuation basis (rates used)</label>
                <input
                  value={basis}
                  onChange={(e) => setBasis(e.target.value)}
                  placeholder="e.g. 420 hrs/month saved × ₹450/hr loaded cost"
                  className={inputCls}
                />
              </div>
            </div>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required when sending back)" className={inputCls} />
          <div className="flex justify-end gap-2">
            <button
              disabled={busy}
              onClick={() => act("rejected")}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
            >
              <XCircle size={14} /> Send back
            </button>
            <button
              disabled={busy}
              onClick={() => act("validated")}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> Validate
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
