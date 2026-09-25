"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Flag, Gavel, Target, XCircle } from "lucide-react";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { formatInr, formatMetricValue, improvementPct, totalValueInr, type ImpactMetric } from "@/lib/impact";

interface Composition {
  status: string;
  solutionPaths: string[];
  problem: { title: string } | null;
  members: Array<{ userId: string; name: string | null; department: string | null; roles: string[] }>;
  decisions: Array<{ phase: number; decision: string; conditions: string | null }>;
}

/**
 * Jury context for one crew inside the scoring dialog (Ideathon):
 * problem + paths, validated before/after numbers with ₹ value, conditions
 * agreed at the gate, and — on a gate stage — the Go / Go-with-changes / Out control.
 */
export function JuryTeamContext({ teamId, phase, onDecided }: { teamId: string; phase: number; onDecided?: () => void }) {
  const { contest } = useContest();
  const { t } = useContestConfig();
  const slug = contest.slug;
  const [comp, setComp] = useState<Composition | null>(null);
  const [metrics, setMetrics] = useState<ImpactMetric[]>([]);
  const [decision, setDecision] = useState<"go" | "conditional" | "out" | "">("");
  const [conditions, setConditions] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const stage = (contest.phaseConfig ?? []).find((p) => p.phase === phase);
  const isGate = !!stage?.gate;

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([
      fetch(`/api/c/${slug}/teams/${teamId}/composition`, { cache: "no-store" }),
      fetch(`/api/c/${slug}/metrics?teamId=${teamId}`, { cache: "no-store" }),
    ]);
    if (c.ok) {
      const data = (await c.json()) as Composition;
      setComp(data);
      const mine = data.decisions.find((d) => d.phase === phase);
      setDecision((mine?.decision as typeof decision) ?? "");
      setConditions(mine?.conditions ?? "");
    }
    if (m.ok) setMetrics(((await m.json()).metrics ?? []) as ImpactMetric[]);
  }, [slug, teamId, phase]);
  useEffect(() => {
    void load();
  }, [load]);

  const saveDecision = async () => {
    if (!decision) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/c/${slug}/stage-decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, phase, decision, conditions }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: "Decision recorded." } : { ok: false, text: data.error ?? "Failed" });
      if (res.ok) {
        await load();
        onDecided?.();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!comp) return null;
  const earlier = comp.decisions.filter((d) => d.phase < phase && d.conditions);
  const shown = metrics.filter((m) => m.baselineStatus === "validated");
  const total = metrics.reduce((s, m) => s + totalValueInr(m), 0);
  const depts = new Set(comp.members.map((m) => m.department).filter(Boolean));

  return (
    <div className="space-y-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-200">
        <Target size={16} className="text-emerald-300" />
        <span className="font-semibold text-white">{comp.problem?.title ?? "No problem claimed"}</span>
        {comp.solutionPaths.map((p) => (
          <span key={p} className="rounded-full border border-white/15 px-2 py-0.5 text-xs">
            {p}
          </span>
        ))}
        <span className="text-xs text-gray-400">
          · {comp.members.length} members from {depts.size} department{depts.size === 1 ? "" : "s"}
        </span>
      </div>

      {earlier.map((d) => (
        <div key={d.phase} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <span className="font-semibold">Changes agreed at the pitch:</span> {d.conditions}
          <span className="block text-xs text-amber-200/80">Check the {t("submission").toLowerCase()} shows how these were met.</span>
        </div>
      ))}

      {shown.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-gray-400">
            Validated before → after
            {total > 0 && <span className="normal-case tracking-normal text-emerald-300">Value to TLE: {formatInr(total)}</span>}
          </div>
          <div className="space-y-2">
            {shown.map((m) => {
              const pct = m.actualStatus === "validated" ? improvementPct(m) : null;
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-black/20 px-3 py-2 text-sm">
                  <span className="font-semibold text-white">{m.name}</span>
                  <span className="text-gray-300">
                    {formatMetricValue(m.baselineValue, m.unit)} →{" "}
                    {m.actualStatus === "validated" ? formatMetricValue(m.actualValue, m.unit) : <em className="text-gray-500">not validated yet</em>}
                  </span>
                  {pct !== null && (
                    <span className={pct >= 0 ? "text-emerald-300" : "text-red-300"}>
                      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
                    </span>
                  )}
                  {m.financeStatus === "validated" && (
                    <span className="ml-auto text-xs text-gray-300">
                      {formatInr(m.realisedValueInr)} now + {formatInr(m.recurringAnnualValueInr)}/yr × {m.recurringYears ?? 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isGate && (
        <div className="rounded-md border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-white">
            <Gavel size={16} /> {stage?.name}: decision
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "go", label: "Go", Icon: CheckCircle2, cls: "border-emerald-500/50 text-emerald-200" },
                { key: "conditional", label: "Go with changes", Icon: Flag, cls: "border-amber-500/50 text-amber-100" },
                { key: "out", label: "Out", Icon: XCircle, cls: "border-red-500/50 text-red-200" },
              ] as const
            ).map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setDecision(o.key)}
                className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm ${o.cls} ${
                  decision === o.key ? "bg-white/15 ring-1 ring-white/40" : "bg-transparent opacity-80 hover:opacity-100"
                }`}
              >
                <o.Icon size={14} /> {o.label}
              </button>
            ))}
          </div>
          {(decision === "conditional" || decision === "out") && (
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={3}
              placeholder={decision === "conditional" ? "The changes the crew agreed to (required)" : "Reason (shared with the crew)"}
              className="mt-3 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            />
          )}
          <div className="mt-3 flex items-center justify-end gap-3">
            {msg && <span className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</span>}
            <button
              type="button"
              disabled={!decision || saving}
              onClick={saveDecision}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Record decision"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            One decision per crew. Organisers or any {t("judge").toLowerCase()} member can record it after the panel agrees.
          </p>
        </div>
      )}
    </div>
  );
}
