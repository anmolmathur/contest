"use client";

import { Plus, Trash2 } from "lucide-react";
import { AUTONOMY_LEVELS, type AgentCharterEntry } from "@/lib/contest-config";
import { parseAgentCharter } from "@/lib/submission-fields";

const cls = "w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-gray-500";

const EMPTY: AgentCharterEntry = {
  name: "",
  platform: "",
  task: "",
  autonomy: "L2",
  humanCheckpoint: "",
  dataAccessed: "",
  guardrails: "",
  monthlyCostInr: null,
};

/** Editor for an Agent Charter field (stored as a JSON string). */
export function AgentCharterEditor({
  value,
  onChange,
  disabled,
}: {
  value: string | string[] | undefined;
  onChange: (json: string | undefined) => void;
  disabled?: boolean;
}) {
  // Keep partially filled rows while editing: parse leniently.
  let rows: AgentCharterEntry[] = [];
  if (typeof value === "string") {
    try {
      const raw = JSON.parse(value);
      rows = Array.isArray(raw) ? (raw as AgentCharterEntry[]) : parseAgentCharter(value);
    } catch {
      rows = [];
    }
  }
  const emit = (next: AgentCharterEntry[]) => onChange(next.length ? JSON.stringify(next) : undefined);
  const set = (i: number, patch: Partial<AgentCharterEntry>) => emit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-gray-400">
            Agent {i + 1}
            <button
              type="button"
              disabled={disabled}
              onClick={() => emit(rows.filter((_, j) => j !== i))}
              className="rounded p-1 text-red-300 hover:bg-red-500/10"
              aria-label="Remove agent"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input className={cls} disabled={disabled} placeholder="Name (e.g. Lead Qualifier)" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
            <input
              className={cls}
              disabled={disabled}
              placeholder="Platform (OpenWebUI, n8n, Claude, vendor tool…)"
              value={r.platform}
              onChange={(e) => set(i, { platform: e.target.value })}
            />
            <textarea
              className={`${cls} md:col-span-2`}
              rows={2}
              disabled={disabled}
              placeholder="What it does, step by step"
              value={r.task}
              onChange={(e) => set(i, { task: e.target.value })}
            />
            <select className={cls} disabled={disabled} value={r.autonomy} onChange={(e) => set(i, { autonomy: e.target.value })}>
              {AUTONOMY_LEVELS.map((l) => (
                <option key={l.key} value={l.key} className="bg-gray-900">
                  {l.label} — {l.hint}
                </option>
              ))}
            </select>
            <input
              className={cls}
              disabled={disabled}
              placeholder="Human checkpoint (who checks what, when)"
              value={r.humanCheckpoint}
              onChange={(e) => set(i, { humanCheckpoint: e.target.value })}
            />
            <input
              className={cls}
              disabled={disabled}
              placeholder="Data it reads / writes"
              value={r.dataAccessed}
              onChange={(e) => set(i, { dataAccessed: e.target.value })}
            />
            <input
              className={cls}
              disabled={disabled}
              placeholder="Guardrails (limits, masking, approvals)"
              value={r.guardrails}
              onChange={(e) => set(i, { guardrails: e.target.value })}
            />
            <input
              className={cls}
              disabled={disabled}
              inputMode="numeric"
              placeholder="Monthly running cost (₹)"
              value={r.monthlyCostInr ?? ""}
              onChange={(e) => set(i, { monthlyCostInr: e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")) })}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => emit([...rows, { ...EMPTY }])}
        className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-50"
      >
        <Plus size={14} /> Add agent
      </button>
    </div>
  );
}
