"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ContestType } from "@/lib/contest-config";
import { getPreset } from "@/lib/contest-types";
import { SectionCard, outlineBtnCls } from "./editor-ui";
import { ContestTypePicker } from "./ContestTypePicker";

/**
 * Contest type selector. Changing the type only changes `contestType` (copy
 * fallbacks); "Apply preset" additionally overwrites the configuration with
 * the preset's defaults after confirmation.
 */
export function ContestTypeCard({
  value,
  onChange,
  onApplyPreset,
  hasScores,
}: {
  value: ContestType;
  onChange: (t: ContestType) => void;
  onApplyPreset: (t: ContestType) => void;
  hasScores: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const preset = getPreset(value);
  return (
    <SectionCard
      title="Contest Type"
      description="The type picks defaults and wording. Switching type alone keeps your current configuration."
      action={
        <Button type="button" variant="outline" className={outlineBtnCls} onClick={() => setConfirmOpen(true)}>
          <RefreshCw className="mr-2" size={16} />
          Apply preset
        </Button>
      }
    >
      <ContestTypePicker value={value} onChange={onChange} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md border-white/10 bg-[#0a0a0a]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Apply {preset.label} preset?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-300">
            <p>This replaces the following in the form with the {preset.label} defaults:</p>
            <ul className="list-disc space-y-0.5 pl-5 text-gray-400">
              <li>Scoring criteria ({preset.scoringCriteria.length}) and scoring scale</li>
              <li>Phases / rounds ({preset.phaseConfig.length})</li>
              <li>Submission fields ({preset.submissionFields.length})</li>
              <li>Terminology and participant roles</li>
              <li>Contest options (showcase, feedback, theme…)</li>
            </ul>
            <p className="text-gray-400">Tracks / categories, teams and landing text are not touched. Nothing is saved until you click Save.</p>
            {hasScores && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300">
                Scores already exist — changing criteria keys or the scale affects how they are read.
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" className={outlineBtnCls} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-gradient-to-r from-neon-purple to-electric-blue"
              onClick={() => {
                onApplyPreset(value);
                setConfirmOpen(false);
              }}
            >
              Apply preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
