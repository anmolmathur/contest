"use client";

import { AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScoreLabel, ScoringScale } from "@/lib/contest-config";
import { SectionCard, inputCls, outlineBtnCls } from "./editor-ui";

const SLIDER_0_100: ScoringScale = { min: 0, max: 100, step: 1 };
const RUBRIC_1_10: ScoringScale = {
  min: 1,
  max: 10,
  step: 1,
  labels: [
    { min: 9, max: 10, label: "Exceptional" },
    { min: 7, max: 8, label: "Strong" },
    { min: 5, max: 6, label: "Average" },
    { min: 3, max: 4, label: "Weak" },
    { min: 1, max: 2, label: "Poor" },
  ],
};

function sameScale(a: ScoringScale, b: ScoringScale): boolean {
  return a.min === b.min && a.max === b.max && a.step === b.step;
}

function num(v: string, fallback: number): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Edits `contests.scoringScale` — the range each criterion is scored on, plus rubric labels. */
export function ScoringScaleEditor({
  value,
  onChange,
  original,
  hasScores,
  judgeTerm = "Judge",
}: {
  value: ScoringScale;
  onChange: (next: ScoringScale) => void;
  /** Scale as currently saved — used to warn when it changes under existing scores. */
  original: ScoringScale;
  hasScores: boolean;
  judgeTerm?: string;
}) {
  const labels = value.labels ?? [];
  const setLabels = (next: ScoreLabel[]) => onChange({ ...value, labels: next });
  const changed = !sameScale(value, original);
  const invalid = !(value.max > value.min) || !(value.step > 0);

  return (
    <SectionCard
      title="Scoring Scale"
      description={`The range a ${judgeTerm.toLowerCase()} scores each criterion on. Rubric labels are shown next to the input.`}
      action={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={outlineBtnCls}
            onClick={() => onChange({ ...SLIDER_0_100 })}
          >
            0–100 slider
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={outlineBtnCls}
            onClick={() => onChange({ ...RUBRIC_1_10, labels: RUBRIC_1_10.labels!.map((l) => ({ ...l })) })}
          >
            1–10 rubric
          </Button>
        </>
      }
    >
      {changed && hasScores && (
        <div className="mb-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Scores already exist. Existing scores are stored as raw numbers and will be reinterpreted on the new
            scale ({value.min}–{value.max}) — they are not converted.
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-gray-300">Min</Label>
          <Input
            type="number"
            value={value.min}
            onChange={(e) => onChange({ ...value, min: num(e.target.value, value.min) })}
            className={inputCls}
          />
        </div>
        <div>
          <Label className="text-xs text-gray-300">Max</Label>
          <Input
            type="number"
            value={value.max}
            onChange={(e) => onChange({ ...value, max: num(e.target.value, value.max) })}
            className={inputCls}
          />
        </div>
        <div>
          <Label className="text-xs text-gray-300">Step</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={value.step}
            onChange={(e) => onChange({ ...value, step: num(e.target.value, value.step) })}
            className={inputCls}
          />
        </div>
      </div>
      {invalid && <p className="mt-2 text-xs text-red-400">Max must be greater than min and step must be positive.</p>}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs text-gray-300">Rubric labels (optional)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-electric-blue hover:bg-white/10"
            onClick={() => setLabels([...labels, { min: value.min, max: value.min, label: "" }])}
          >
            <Plus size={12} className="mr-1" /> Add label
          </Button>
        </div>
        {labels.length === 0 ? (
          <p className="text-xs text-gray-500">No labels — {judgeTerm.toLowerCase()}s just see numbers.</p>
        ) : (
          <div className="space-y-2">
            {labels.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="number"
                  value={l.min}
                  onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, min: num(e.target.value, x.min) } : x)))}
                  className={`${inputCls} w-16 sm:w-20`}
                  aria-label="From"
                />
                <span className="text-gray-500">–</span>
                <Input
                  type="number"
                  value={l.max}
                  onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, max: num(e.target.value, x.max) } : x)))}
                  className={`${inputCls} w-16 sm:w-20`}
                  aria-label="To"
                />
                <Input
                  value={l.label}
                  onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Strong"
                  className={`${inputCls} min-w-0 flex-1`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLabels(labels.filter((_, j) => j !== i))}
                  className="h-8 w-8 shrink-0 p-0 text-red-400 hover:bg-red-500/10"
                  aria-label="Remove label"
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
