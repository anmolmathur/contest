"use client";

import type { ScoringScale } from "@/lib/contest-config";
import { scaleLabelFor } from "@/lib/contest-config";
import { Slider } from "@/components/ui/slider";

/**
 * One criterion's score input. Small scales (≤ 11 steps, e.g. 1–10) render
 * as a row of buttons with the rubric label; larger scales (0–100) keep the
 * slider the judging UI always had.
 */
export function CriterionInput({
  scale,
  value,
  onChange,
  disabled,
  size = "md",
}: {
  scale: ScoringScale;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  size?: "md" | "lg";
}) {
  const steps = Math.floor((scale.max - scale.min) / scale.step) + 1;
  const label = scaleLabelFor(scale, value);

  if (steps <= 11) {
    const values = Array.from({ length: steps }, (_, i) => scale.min + i * scale.step);
    return (
      <div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup">
          {values.map((v) => {
            const active = v === value;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onChange(v)}
                className={`${size === "lg" ? "h-12 min-w-12 text-lg" : "h-9 min-w-9 text-sm"} rounded-md border px-2 font-semibold transition ${
                  active
                    ? "border-neon-purple bg-neon-purple text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                    : "border-white/15 bg-white/5 text-gray-300 hover:border-white/40"
                } disabled:opacity-50`}
              >
                {v}
              </button>
            );
          })}
        </div>
        <div className="mt-1 h-4 text-xs text-gray-400">{label ? `${value} — ${label}` : null}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Slider
        value={[value]}
        min={scale.min}
        max={scale.max}
        step={scale.step}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0])}
        className="flex-1"
      />
      <span className="w-20 text-right text-sm font-semibold text-white">
        {value}
        {label ? <span className="ml-1 text-xs font-normal text-gray-400">{label}</span> : null}
      </span>
    </div>
  );
}
