"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Search } from "lucide-react";
import BackgroundPattern from "@/components/BackgroundPattern";
import GlassCard from "@/components/GlassCard";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { AUTONOMY_LEVELS, type AgentCharterEntry } from "@/lib/contest-config";

type AgentRow = AgentCharterEntry & { teamId: string; teamName: string; teamStatus: string; track: string | null; stage: string | null };

const LEVEL_CLS: Record<string, string> = {
  L1: "bg-sky-500/15 text-sky-200",
  L2: "bg-violet-500/15 text-violet-200",
  L3: "bg-amber-500/15 text-amber-100",
  L4: "bg-emerald-500/15 text-emerald-200",
};

/** Agent Registry — the org's inventory of AI agents built in the contest. */
export default function AgentRegistryPage() {
  const { contest } = useContest();
  const { t } = useContestConfig();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading");
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/c/${contest.slug}/agents`, { cache: "no-store" });
      if (!res.ok) return setStatus("unavailable");
      setAgents(((await res.json()).agents ?? []) as AgentRow[]);
      setStatus("ok");
    })();
  }, [contest.slug]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter(
      (a) =>
        (level === "all" || a.autonomy === level) &&
        (!q || [a.name, a.task, a.platform, a.teamName, a.track].filter(Boolean).join(" ").toLowerCase().includes(q)),
    );
  }, [agents, level, query]);

  const platforms = new Set(agents.map((a) => a.platform).filter(Boolean)).size;
  const monthly = agents.reduce((s, a) => s + (a.monthlyCostInr ?? 0), 0);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <BackgroundPattern />
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-14 sm:pt-20">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-300">
          <Bot size={14} className="text-emerald-300" /> Agent Registry
        </div>
        <h1 className="text-3xl font-black text-white sm:text-5xl">Every agent, on the record</h1>
        <p className="mt-3 max-w-3xl text-gray-300">
          Each {t("team").toLowerCase()} that builds an AI agent registers it here: what it does, how autonomous it is,
          where a human checks it, and what it costs. This becomes our inventory of agents after the contest.
        </p>
        {status === "ok" && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "Agents", v: agents.length },
              { k: "Platforms", v: platforms },
              { k: `${t("team")}s building agents`, v: new Set(agents.map((a) => a.teamId)).size },
              { k: "Running cost / month", v: monthly ? `₹${monthly.toLocaleString("en-IN")}` : "—" },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-2xl font-black text-white">{s.v}</div>
                <div className="text-xs text-gray-400">{s.k}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-24">
        {status === "unavailable" ? (
          <p className="text-gray-400">The registry is not public yet.</p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {[{ key: "all", label: "All levels" }, ...AUTONOMY_LEVELS].map((l) => (
                <button
                  key={l.key}
                  onClick={() => setLevel(l.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    level === l.key ? "border-white/40 bg-white/15 text-white" : "border-white/15 text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {l.label}
                </button>
              ))}
              <div className="relative ml-auto w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search agents"
                  className="w-full rounded-md border border-white/15 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            {status === "loading" ? (
              <p className="text-gray-400">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="text-gray-400">No agents registered yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {visible.map((a, i) => (
                  <GlassCard key={`${a.teamId}-${i}`} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Bot size={16} className="text-emerald-300" />
                      <span className="text-lg font-bold text-white">{a.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_CLS[a.autonomy] ?? "bg-white/10 text-gray-200"}`}>
                        {AUTONOMY_LEVELS.find((l) => l.key === a.autonomy)?.label ?? a.autonomy}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {a.teamName}
                      {a.track ? ` · ${a.track}` : ""}
                      {a.platform ? ` · ${a.platform}` : ""}
                    </div>
                    <p className="mt-3 whitespace-pre-line text-sm text-gray-200">{a.task}</p>
                    <dl className="mt-3 space-y-1 text-xs text-gray-300">
                      {a.humanCheckpoint && (
                        <div>
                          <dt className="inline text-gray-500">Human checkpoint: </dt>
                          <dd className="inline">{a.humanCheckpoint}</dd>
                        </div>
                      )}
                      {a.dataAccessed && (
                        <div>
                          <dt className="inline text-gray-500">Data: </dt>
                          <dd className="inline">{a.dataAccessed}</dd>
                        </div>
                      )}
                      {a.guardrails && (
                        <div>
                          <dt className="inline text-gray-500">Guardrails: </dt>
                          <dd className="inline">{a.guardrails}</dd>
                        </div>
                      )}
                      {a.monthlyCostInr ? (
                        <div>
                          <dt className="inline text-gray-500">Cost: </dt>
                          <dd className="inline">₹{a.monthlyCostInr.toLocaleString("en-IN")} / month</dd>
                        </div>
                      ) : null}
                    </dl>
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
