"use client";

import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { IDEATHON_PLAYBOOKS, currentStage, fillTokens, playbookRoleFor } from "@/lib/playbooks/ideathon";

/** "Your next action": this stage's playbook steps for the viewer's role. */
export function NextActionCard({ role }: { role: string | null | undefined }) {
  const { contest } = useContest();
  const { t } = useContestConfig();
  const key = playbookRoleFor(role);
  const pb = IDEATHON_PLAYBOOKS[key];
  const phases = contest.phaseConfig ?? [];
  const stage = currentStage(phases);
  const steps = stage === null ? [] : pb.steps.filter((s) => s.stage === stage);
  const stageName = stage === 0 ? "Before launch" : phases.find((p) => p.phase === stage)?.name;
  const tr = (x: string) => fillTokens(x, t);

  return (
    <GlassCard className="mb-8 p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Compass className="text-emerald-300" size={22} />
        <h2 className="text-xl font-bold text-white">Your next action</h2>
        <span className="text-sm text-gray-400">
          as {tr(pb.title).replace(/s$/, "")}
          {stageName ? ` · ${stageName}` : ""}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          {role === "validator" && (
            <Link href={`/c/${contest.slug}/validate`} className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-black hover:bg-emerald-400">
              Open the {t("validator")} desk
            </Link>
          )}
          {(role === "judge" || role === "admin") && (
            <Link href={`/c/${contest.slug}/judging`} className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-black hover:bg-emerald-400">
              Go to scoring
            </Link>
          )}
          <Link href={`/c/${contest.slug}/playbook?for=${key}`} className="inline-flex items-center gap-1 text-sm text-electric-blue hover:underline">
            Full playbook <ArrowRight size={14} />
          </Link>
        </span>
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-gray-300">
          {stage === null
            ? "Stage dates aren't set yet. Open the playbook to see the whole journey."
            : "Nothing specific for you this stage. Check the playbook for what's coming next."}
        </p>
      ) : (
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-200">{i + 1}</span>
              <span>
                <span className="text-white">{tr(s.what)}</span>
                <span className="block text-xs text-gray-400">
                  {tr(s.when)} · {tr(s.where)} → {tr(s.output)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  );
}
