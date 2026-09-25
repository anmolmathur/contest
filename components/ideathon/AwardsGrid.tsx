"use client";

import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import type { ContestAward } from "@/lib/contest-types";

type AwardRow = ContestAward & { winnerTeamName?: string | null };

/**
 * Category awards (on top of ranked prizes). Winners appear once results are
 * published; before that the cards show what each award is for.
 */
export function AwardsGrid({ slug, initial }: { slug: string; initial?: ContestAward[] | null }) {
  const [awards, setAwards] = useState<AwardRow[]>(initial ?? []);
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/c/${slug}/awards`, { cache: "no-store" });
      if (res.ok) setAwards(((await res.json()).awards ?? []) as AwardRow[]);
    })();
  }, [slug]);
  if (!awards.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {awards.map((a) => (
        <GlassCard key={a.key} className="p-5">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-300" />
            <span className="text-lg font-bold text-white">{a.label}</span>
            {a.amount ? <span className="ml-auto text-sm font-semibold text-amber-200">₹{a.amount.toLocaleString("en-IN")}</span> : null}
          </div>
          <p className="mt-1 text-sm text-gray-400">{a.description}</p>
          {a.winnerTeamName && (
            <p className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
              🏆 {a.winnerTeamName}
            </p>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
