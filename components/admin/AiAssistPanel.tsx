"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { AiContestSetup, type ContestDraft } from "@/components/admin/AiContestSetup";

/**
 * Collapsible wrapper around the AI setup assistant in "edit" mode. Applied
 * patches only change the settings form — the admin still reviews and saves.
 */
export function AiAssistPanel({
  slug,
  onApply,
  lastApplied,
}: {
  slug: string;
  onApply: (patch: ContestDraft) => void;
  /** Short summary of the last applied patch, shown under the panel. */
  lastApplied?: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Keep the assistant mounted after first open so its conversation survives collapsing.
  const [mounted, setMounted] = useState(false);
  return (
    <GlassCard className="border-neon-purple/30 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setMounted(true);
        }}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <Sparkles className="text-neon-purple" size={22} />
          <span>
            <span className="block text-xl font-bold text-white">AI assist</span>
            <span className="block text-sm text-gray-400">
              Describe a change (e.g. “switch to a 1–10 rubric and add a pitch video field to the finale”). Suggestions
              fill the form below — nothing is saved until you click Save.
            </span>
          </span>
        </span>
        <ChevronDown className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} size={20} />
      </button>
      {mounted && (
        <div className={open ? "mt-4" : "hidden"}>
          <AiContestSetup mode="edit" contestSlug={slug} onApply={onApply} />
        </div>
      )}
      {lastApplied && <p className="mt-3 text-xs text-green-400">{lastApplied}</p>}
    </GlassCard>
  );
}
