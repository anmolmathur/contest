"use client";

import { useState } from "react";
import { EyeOff, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";

/**
 * "Publish results" switch. Flips `settings.resultsPublished` through
 * POST /api/c/[slug]/results/publish (which also notifies teams on publish).
 */
export function ResultsPublishCard({
  slug,
  published,
  feedbackVisibility,
  judgeTerm = "Judge",
  onChange,
  onError,
}: {
  slug: string;
  published: boolean;
  feedbackVisibility: "never" | "after_results" | undefined;
  judgeTerm?: string;
  onChange: (published: boolean, settings: Record<string, unknown> | null) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !published;
    const prompt = next
      ? "Publish results? Teams are notified and the results become visible" +
        (feedbackVisibility === "never" ? "." : `, including ${judgeTerm.toLowerCase()} feedback.`)
      : "Unpublish results? Teams will no longer see results or feedback.";
    if (!confirm(prompt)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${slug}/results/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Failed to update results");
        return;
      }
      onChange(next, (data.settings as Record<string, unknown>) ?? null);
    } catch {
      onError("Failed to update results");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <Megaphone className={published ? "text-green-400" : "text-gray-500"} size={28} />
        <div>
          <h3 className="text-lg font-bold text-white">
            Results {published ? <span className="text-green-400">published</span> : <span className="text-gray-400">not published</span>}
          </h3>
          <p className="text-sm text-gray-400">
            {published
              ? "Teams can see final results" + (feedbackVisibility === "never" ? "." : ` and ${judgeTerm.toLowerCase()} feedback.`)
              : "Publish once judging is complete. Teams are notified in-app and by email."}
          </p>
        </div>
      </div>
      <Button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={
          published
            ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
            : "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
        }
      >
        {busy ? (
          <Loader2 size={16} className="mr-2 animate-spin" />
        ) : published ? (
          <EyeOff size={16} className="mr-2" />
        ) : (
          <Megaphone size={16} className="mr-2" />
        )}
        {published ? "Unpublish" : "Publish results"}
      </Button>
    </GlassCard>
  );
}
