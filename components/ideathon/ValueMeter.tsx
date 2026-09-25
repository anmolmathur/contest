"use client";

import { useEffect, useState } from "react";
import { Bot, IndianRupee, Repeat, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { formatInr } from "@/lib/impact";

interface Summary {
  totalValueInr: number;
  realisedInr: number;
  recurringAnnualInr: number;
  avgImprovementPct: number | null;
  validatedMetrics: number;
  teamsWithProof: number;
  activeTeams: number;
  agents: number;
  paths: Record<string, number>;
}

/** "Value Unlocked" meter — validated value to the organisation, live. */
export function ValueMeter({ slug, teamWord = "Team", compact = false }: { slug: string; teamWord?: string; compact?: boolean }) {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/c/${slug}/impact-summary`, { cache: "no-store" });
      if (res.ok && alive) setS((await res.json()) as Summary);
    })();
    return () => {
      alive = false;
    };
  }, [slug]);
  if (!s) return null;

  const tiles = [
    { Icon: IndianRupee, label: "Realised so far", value: formatInr(s.realisedInr) },
    { Icon: Repeat, label: "Recurring every year", value: formatInr(s.recurringAnnualInr) },
    { Icon: TrendingUp, label: "Avg improvement vs baseline", value: s.avgImprovementPct === null ? "—" : `${s.avgImprovementPct}%` },
    { Icon: Bot, label: "AI agents registered", value: String(s.agents) },
    { Icon: ShieldCheck, label: "Validated metrics", value: String(s.validatedMetrics) },
    { Icon: Users, label: `${teamWord}s with proof`, value: `${s.teamsWithProof} / ${s.activeTeams}` },
  ];

  return (
    <div className={`rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10 ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Value Unlocked</div>
        <div className={`mt-2 font-black text-white ${compact ? "text-4xl" : "text-5xl sm:text-7xl"}`}>{formatInr(s.totalValueInr)}</div>
        <p className="mt-2 text-sm text-gray-400">
          Validated value to the organisation: realised now + recurring value (up to 3 years). Only Auditor- and
          Finance-validated numbers count.
        </p>
      </div>
      <div className={`mt-6 grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
            <t.Icon size={16} className="mx-auto text-emerald-300" />
            <div className="mt-1 text-lg font-bold text-white">{t.value}</div>
            <div className="text-[11px] text-gray-400">{t.label}</div>
          </div>
        ))}
      </div>
      {Object.keys(s.paths).length > 0 && !compact && (
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-gray-300">
          {Object.entries(s.paths).map(([p, n]) => (
            <span key={p} className="rounded-full border border-white/15 px-2.5 py-0.5">
              {p}: {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
