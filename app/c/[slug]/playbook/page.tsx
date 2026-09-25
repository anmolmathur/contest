"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CheckCircle2, Download, XCircle } from "lucide-react";
import BackgroundPattern from "@/components/BackgroundPattern";
import GlassCard from "@/components/GlassCard";
import { Wordmark } from "@/components/Wordmark";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { useMyMembership } from "@/lib/use-my-membership";
import {
  IDEATHON_PLAYBOOKS,
  STAKEHOLDER_ORDER,
  currentStage,
  fillTokens,
  playbookRoleFor,
  type StakeholderKey,
} from "@/lib/playbooks/ideathon";

function fmtDate(d?: string) {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Stakeholder playbooks: what each person does, and when (tab per stakeholder). */
export default function PlaybookPage() {
  const { contest } = useContest();
  const { t } = useContestConfig();
  const { me } = useMyMembership(contest.slug);
  const forParam = useSearchParams().get("for") as StakeholderKey | null;
  const [tab, setTab] = useState<StakeholderKey | null>(null);
  const phases = useMemo(() => contest.phaseConfig ?? [], [contest.phaseConfig]);
  const nowStage = useMemo(() => currentStage(phases), [phases]);

  // Explicit tab click > ?for= link > the viewer's own role.
  const active: StakeholderKey =
    tab ?? (forParam && STAKEHOLDER_ORDER.includes(forParam) ? forParam : playbookRoleFor(me?.role));
  const pb = IDEATHON_PLAYBOOKS[active];
  const tr = (s: string) => fillTokens(s, t);
  const stageLabel = (n: number) => {
    if (n === 0) return { name: "Before launch", dates: "" };
    const p = phases.find((x) => x.phase === n);
    const dates = p?.startDate ? `${fmtDate(p.startDate)}${p.endDate && p.endDate !== p.startDate ? ` – ${fmtDate(p.endDate)}` : ""}` : "";
    return { name: p?.name ?? `${t("phase")} ${n}`, dates };
  };
  const groups = pb.steps.reduce<Array<{ stage: number; steps: typeof pb.steps }>>((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && last.stage === s.stage) last.steps.push(s);
    else acc.push({ stage: s.stage, steps: [s] });
    return acc;
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <BackgroundPattern />
      <section className="mx-auto max-w-5xl px-4 pb-6 pt-14 sm:pt-20">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-300">
          <BookOpen size={14} className="text-emerald-300" /> Playbook
        </div>
        <h1 className="text-3xl font-black text-white sm:text-5xl">
          Who does what in <Wordmark segments={contest.wordmark} fallback={contest.name} accentClassName="text-emerald-300" />
        </h1>
        <p className="mt-3 max-w-3xl text-gray-300">Pick your role to see exactly what you do, and when.</p>
        <div className="mt-6 flex flex-wrap gap-2" role="tablist">
          {STAKEHOLDER_ORDER.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={active === k}
              onClick={() => setTab(k)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                active === k ? "border-emerald-400/60 bg-emerald-400/15 text-white" : "border-white/15 text-gray-300 hover:bg-white/5"
              }`}
            >
              {tr(IDEATHON_PLAYBOOKS[k].title)}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-6 px-4 pb-24">
        <GlassCard className="p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-gray-400">{tr(pb.who)}</div>
              <p className="mt-1 text-lg text-white">{tr(pb.summary)}</p>
            </div>
            <a
              href={`/api/c/${contest.slug}/playbook/${pb.key}/pdf`}
              className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              <Download size={14} /> PDF
            </a>
          </div>
        </GlassCard>

        {pb.roleCards && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pb.roleCards.map((r) => (
              <GlassCard key={r.role} className="p-4">
                <div className="font-bold text-white">{r.role}</div>
                <ul className="mt-2 space-y-1 text-sm text-gray-300">
                  {r.does.map((d) => (
                    <li key={d}>• {tr(d)}</li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {groups.map((g) => {
            const lbl = stageLabel(g.stage);
            const now = nowStage === g.stage;
            return (
              <GlassCard key={g.stage} className={`p-5 ${now ? "border-emerald-400/60 shadow-[0_0_30px_rgba(16,185,129,0.25)]" : ""}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-white">{lbl.name}</span>
                  {lbl.dates && <span className="text-sm text-gray-400">{lbl.dates}</span>}
                  {now && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-black">This week</span>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="w-28 py-1 pr-3 font-semibold">When</th>
                        <th className="py-1 pr-3 font-semibold">What you do</th>
                        <th className="w-44 py-1 pr-3 font-semibold">Where</th>
                        <th className="w-44 py-1 font-semibold">Output</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.steps.map((s, i) => (
                        <tr key={i} className="border-t border-white/5 align-top">
                          <td className="py-2 pr-3 text-gray-300">{tr(s.when)}</td>
                          <td className="py-2 pr-3 text-white">{tr(s.what)}</td>
                          <td className="py-2 pr-3 text-gray-300">{tr(s.where)}</td>
                          <td className="py-2 text-emerald-200">{tr(s.output)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <GlassCard className="p-5">
            <h3 className="mb-2 font-bold text-white">Do</h3>
            <ul className="space-y-1.5 text-sm text-gray-200">
              {pb.dos.map((d) => (
                <li key={d} className="flex gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" /> {tr(d)}
                </li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="mb-2 font-bold text-white">Don&apos;t</h3>
            <ul className="space-y-1.5 text-sm text-gray-200">
              {pb.donts.map((d) => (
                <li key={d} className="flex gap-2">
                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" /> {tr(d)}
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>

        <GlassCard className="p-5">
          <h3 className="mb-3 font-bold text-white">Questions</h3>
          <dl className="space-y-3">
            {pb.faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-white">{tr(f.q)}</dt>
                <dd className="text-sm text-gray-300">{tr(f.a)}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>
      </section>
    </main>
  );
}
