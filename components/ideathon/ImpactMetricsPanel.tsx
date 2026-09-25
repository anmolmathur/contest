"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Clock, Paperclip, Pencil, Plus, Send, Trash2, Upload, XCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { uploadFile } from "@/lib/uploads/client";
import {
  METRIC_CATEGORIES,
  STATUS_LABEL,
  formatInr,
  formatMetricValue,
  improvementPct,
  totalValueInr,
  type ImpactMetric,
} from "@/lib/impact";

const inputCls = "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500";

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "validated"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : status === "submitted" || status === "pending"
        ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
        : status === "rejected"
          ? "border-red-500/40 bg-red-500/10 text-red-200"
          : "border-white/15 bg-white/5 text-gray-300";
  const Icon = status === "validated" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <Icon size={11} /> {STATUS_LABEL[status] ?? status}
    </span>
  );
}

type Draft = {
  name: string;
  unit: string;
  direction: "increase" | "decrease";
  category: string;
  sourceSystem: string;
  method: string;
  baselineValue: string;
  baselinePeriod: string;
  baselineEvidence: string[];
  targetValue: string;
  actualValue: string;
  actualPeriod: string;
  actualEvidence: string[];
};

const EMPTY: Draft = {
  name: "",
  unit: "",
  direction: "decrease",
  category: "time",
  sourceSystem: "",
  method: "",
  baselineValue: "",
  baselinePeriod: "",
  baselineEvidence: [],
  targetValue: "",
  actualValue: "",
  actualPeriod: "",
  actualEvidence: [],
};

function draftOf(m: ImpactMetric): Draft {
  const s = (v: number | null) => (v === null || v === undefined ? "" : String(v));
  return {
    name: m.name,
    unit: m.unit ?? "",
    direction: m.direction === "increase" ? "increase" : "decrease",
    category: m.category,
    sourceSystem: m.sourceSystem ?? "",
    method: m.method ?? "",
    baselineValue: s(m.baselineValue),
    baselinePeriod: m.baselinePeriod ?? "",
    baselineEvidence: m.baselineEvidence ?? [],
    targetValue: s(m.targetValue),
    actualValue: s(m.actualValue),
    actualPeriod: m.actualPeriod ?? "",
    actualEvidence: m.actualEvidence ?? [],
  };
}

/**
 * Ideathon before/after metrics for a crew: define a metric, submit the
 * baseline for an Auditor to validate, then submit actuals after the live run.
 * Finance's valuation (realised + recurring ₹) shows once validated.
 */
export function ImpactMetricsPanel({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const { contest } = useContest();
  const { t } = useContestConfig();
  const slug = contest.slug;
  const [metrics, setMetrics] = useState<ImpactMetric[]>([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const auditor = t("validator");

  const load = useCallback(async () => {
    const res = await fetch(`/api/c/${slug}/metrics`, { cache: "no-store" });
    if (res.ok) setMetrics(((await res.json()).metrics ?? []) as ImpactMetric[]);
  }, [slug]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (action?: "submitBaseline" | "submitActual", id?: string) => {
    setBusy(true);
    setErr("");
    try {
      const target = id ?? (editing !== "new" ? editing : null);
      const body = {
        ...draft,
        baselineValue: draft.baselineValue === "" ? null : draft.baselineValue,
        targetValue: draft.targetValue === "" ? null : draft.targetValue,
        actualValue: draft.actualValue === "" ? null : draft.actualValue,
        action,
      };
      const res = await fetch(target ? `/api/c/${slug}/metrics/${target}` : `/api/c/${slug}/metrics`, {
        method: target ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Could not save");
        return;
      }
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submitOnly = async (m: ImpactMetric, action: "submitBaseline" | "submitActual") => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/c/${slug}/metrics/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Could not submit");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: ImpactMetric) => {
    if (!confirm(`Remove "${m.name}"?`)) return;
    await fetch(`/api/c/${slug}/metrics/${m.id}`, { method: "DELETE" });
    await load();
  };

  const upload = async (file: File | undefined, key: "baselineEvidence" | "actualEvidence") => {
    if (!file) return;
    setErr("");
    try {
      const { publicUrl } = await uploadFile({ file, kind: "submission_file", contestId: contest.id, teamId });
      setDraft((d) => ({ ...d, [key]: [...d[key], publicUrl] }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const total = metrics.reduce((s, m) => s + totalValueInr(m), 0);

  return (
    <GlassCard className="mb-8 p-6 sm:p-8">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <BarChart3 className="text-emerald-300" size={28} />
        <h2 className="text-2xl font-bold text-white">Before → After</h2>
        {total > 0 && (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-sm font-semibold text-emerald-200">
            Validated value to TLE: {formatInr(total)}
          </span>
        )}
        {canEdit && editing === null && metrics.length < 5 && (
          <button
            onClick={() => {
              setDraft(EMPTY);
              setEditing("new");
              setErr("");
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            <Plus size={14} /> Add metric
          </button>
        )}
      </div>
      <p className="mb-5 text-sm text-gray-400">
        Only numbers validated by an {auditor} count. Submit the baseline before you build, and the actuals after the
        live run.
      </p>
      {err && <p className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</p>}

      {editing !== null && (
        <MetricForm
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          baselineLocked={false}
          showActual={editing !== "new" && metrics.find((m) => m.id === editing)?.baselineStatus === "validated"}
          onUpload={upload}
          onCancel={() => setEditing(null)}
          onSave={() => save()}
        />
      )}

      {metrics.length === 0 && editing === null && (
        <p className="text-gray-400">No metrics yet. Add the one number your problem is about.</p>
      )}

      <div className="space-y-3">
        {metrics.map((m) => {
          const pct = m.actualStatus === "validated" ? improvementPct(m) : null;
          return (
            <div key={m.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{m.name}</span>
                <span className="text-xs text-gray-400">
                  {METRIC_CATEGORIES.find((c) => c.key === m.category)?.label} · {m.direction === "decrease" ? "lower is better" : "higher is better"}
                  {m.sourceSystem ? ` · from ${m.sourceSystem}` : ""}
                </span>
                {canEdit && editing === null && (
                  <span className="ml-auto flex gap-1">
                    <button
                      onClick={() => {
                        setDraft(draftOf(m));
                        setEditing(m.id);
                        setErr("");
                      }}
                      className="rounded p-1 text-gray-300 hover:bg-white/10"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    {m.baselineStatus !== "validated" && (
                      <button onClick={() => remove(m)} className="rounded p-1 text-gray-300 hover:bg-white/10" title="Remove">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Cell label="Before (baseline)" value={formatMetricValue(m.baselineValue, m.unit)} sub={m.baselinePeriod} status={m.baselineStatus} note={m.baselineNote} evidence={m.baselineEvidence} />
                <Cell label="Target" value={formatMetricValue(m.targetValue, m.unit)} />
                <Cell label="After (actual)" value={formatMetricValue(m.actualValue, m.unit)} sub={m.actualPeriod} status={m.actualStatus} note={m.actualNote} evidence={m.actualEvidence} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {pct !== null && (
                  <span className={pct >= 0 ? "text-emerald-300" : "text-red-300"}>
                    {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% {pct >= 0 ? "better" : "worse"}
                  </span>
                )}
                {m.financeStatus === "validated" ? (
                  <span className="text-gray-200">
                    Value: <strong className="text-white">{formatInr(m.realisedValueInr)}</strong> realised +{" "}
                    <strong className="text-white">{formatInr(m.recurringAnnualValueInr)}</strong>/yr × {m.recurringYears ?? 1} ={" "}
                    <strong className="text-emerald-300">{formatInr(totalValueInr(m))}</strong>
                  </span>
                ) : m.actualStatus === "validated" ? (
                  <StatusPill status={m.financeStatus === "rejected" ? "rejected" : "pending"} />
                ) : null}
                {m.financeNote && <span className="text-xs text-gray-400">Finance: {m.financeNote}</span>}
                {canEdit && editing === null && (m.baselineStatus === "draft" || m.baselineStatus === "rejected") && (
                  <button
                    disabled={busy}
                    onClick={() => submitOnly(m, "submitBaseline")}
                    className="ml-auto inline-flex items-center gap-1 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
                  >
                    <Send size={12} /> Submit baseline to {auditor}
                  </button>
                )}
                {canEdit &&
                  editing === null &&
                  m.baselineStatus === "validated" &&
                  (m.actualStatus === "draft" || m.actualStatus === "rejected") &&
                  (m.actualValue === null ? (
                    <button
                      onClick={() => {
                        setDraft(draftOf(m));
                        setEditing(m.id);
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      <Plus size={12} /> Add actuals
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => submitOnly(m, "submitActual")}
                      className="ml-auto inline-flex items-center gap-1 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
                    >
                      <Send size={12} /> Submit actuals to {auditor}
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function Cell({
  label,
  value,
  sub,
  status,
  note,
  evidence,
}: {
  label: string;
  value: string;
  sub?: string | null;
  status?: string;
  note?: string | null;
  evidence?: string[] | null;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
        {label} {status && <StatusPill status={status} />}
      </div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {note && <div className="mt-1 text-xs text-amber-200">{note}</div>}
      {evidence && evidence.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {evidence.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-electric-blue hover:underline">
              <Paperclip size={11} /> Evidence {i + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricForm({
  draft,
  setDraft,
  busy,
  showActual,
  onUpload,
  onCancel,
  onSave,
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  busy: boolean;
  baselineLocked: boolean;
  showActual: boolean;
  onUpload: (f: File | undefined, key: "baselineEvidence" | "actualEvidence") => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));
  const evidence = (k: "baselineEvidence" | "actualEvidence") => (
    <div className="md:col-span-2">
      <label className="mb-1 block text-xs text-gray-300">Evidence (report export, query screenshot, dashboard link)</label>
      <div className="flex flex-wrap items-center gap-2">
        {draft[k].map((u, i) => (
          <span key={u} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-xs text-gray-200">
            <Paperclip size={11} /> {i + 1}
            <button type="button" onClick={() => setDraft((d) => ({ ...d, [k]: d[k].filter((x) => x !== u) }))} className="text-gray-400 hover:text-white">
              ×
            </button>
          </span>
        ))}
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10">
          <Upload size={12} /> Upload
          <input type="file" className="hidden" onChange={(e) => onUpload(e.target.files?.[0], k)} />
        </label>
        <input
          placeholder="or paste a link and press Enter"
          className={`${inputCls} max-w-xs py-1 text-xs`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) setDraft((d) => ({ ...d, [k]: [...d[k], v] }));
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
      </div>
    </div>
  );
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-gray-300">Metric</label>
        <input value={draft.name} onChange={set("name")} placeholder="Admission TAT" className={inputCls} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-1 block text-xs text-gray-300">Unit</label>
          <input value={draft.unit} onChange={set("unit")} placeholder="days / % / ₹" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-300">Better is</label>
          <select value={draft.direction} onChange={set("direction")} className={inputCls}>
            <option value="decrease" className="bg-gray-900">Lower</option>
            <option value="increase" className="bg-gray-900">Higher</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-300">Type</label>
          <select value={draft.category} onChange={set("category")} className={inputCls}>
            {METRIC_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key} className="bg-gray-900">
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-300">Source system</label>
        <input value={draft.sourceSystem} onChange={set("sourceSystem")} placeholder="CRM / UMS / Snowflake report" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-300">How it is measured</label>
        <input value={draft.method} onChange={set("method")} placeholder="Avg days from application to admission, all Univ Z applications" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-300">Baseline value</label>
        <input value={draft.baselineValue} onChange={set("baselineValue")} inputMode="decimal" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-gray-300">Baseline period</label>
          <input value={draft.baselinePeriod} onChange={set("baselinePeriod")} placeholder="1–31 Aug 2026" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-300">Target</label>
          <input value={draft.targetValue} onChange={set("targetValue")} inputMode="decimal" className={inputCls} />
        </div>
      </div>
      {evidence("baselineEvidence")}
      {showActual && (
        <>
          <div>
            <label className="mb-1 block text-xs text-gray-300">Actual value (after)</label>
            <input value={draft.actualValue} onChange={set("actualValue")} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-300">Actual period</label>
            <input value={draft.actualPeriod} onChange={set("actualPeriod")} placeholder="Live run: 3–16 Nov 2026" className={inputCls} />
          </div>
          {evidence("actualEvidence")}
        </>
      )}
      <p className="text-xs text-gray-400 md:col-span-2">
        Changing a value that was already validated sends it back to draft for re-validation.
      </p>
      <div className="flex justify-end gap-2 md:col-span-2">
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
