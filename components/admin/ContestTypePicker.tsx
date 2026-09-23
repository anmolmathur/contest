"use client";

import { Code2, Presentation } from "lucide-react";
import { CONTEST_TYPES, type ContestType } from "@/lib/contest-config";
import { getPreset } from "@/lib/contest-types";
import { cn } from "@/lib/utils";

const ICONS: Record<ContestType, typeof Code2> = {
  hackathon: Code2,
  business_symposium: Presentation,
};

export const TYPE_BADGE_CLS: Record<ContestType, string> = {
  hackathon: "bg-electric-blue/20 text-electric-blue",
  business_symposium: "bg-amber-500/20 text-amber-300",
};

/** Small pill showing the contest type. */
export function ContestTypeBadge({ type, className }: { type: string | null | undefined; className?: string }) {
  const preset = getPreset(type);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", TYPE_BADGE_CLS[preset.type], className)}>
      {preset.label}
    </span>
  );
}

/** Two selectable cards, one per contest type. */
export function ContestTypePicker({
  value,
  onChange,
  compact = false,
}: {
  value: ContestType;
  onChange: (t: ContestType) => void;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Contest type">
      {CONTEST_TYPES.map((t) => {
        const p = getPreset(t);
        const Icon = ICONS[t];
        const on = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              on
                ? "border-neon-purple/50 bg-neon-purple/10 text-white"
                : "border-white/10 bg-transparent text-gray-400 hover:bg-white/5",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon size={18} className={on ? "text-neon-purple" : "text-gray-500"} />
              <span className="font-semibold">{p.label}</span>
            </div>
            <div className="mt-1 text-xs font-medium opacity-90">{p.tagline}</div>
            {!compact && <div className="mt-1 text-xs opacity-70">{p.description}</div>}
          </button>
        );
      })}
    </div>
  );
}
