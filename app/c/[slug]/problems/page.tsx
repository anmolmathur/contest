"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Lightbulb, Plus, Search, Target, Users, XCircle } from "lucide-react";
import BackgroundPattern from "@/components/BackgroundPattern";
import GlassCard from "@/components/GlassCard";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { useMyMembership } from "@/lib/use-my-membership";
import type { ProblemWithClaims } from "@/lib/problems";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  approved: { label: "Crew proposal", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  proposed: { label: "Awaiting approval", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  rejected: { label: "Not approved", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  closed: { label: "Closed", cls: "bg-white/10 text-gray-300 border-white/20" },
};

export default function ProblemBankPage() {
  const { contest } = useContest();
  const { t, settings } = useContestConfig();
  const slug = contest.slug;
  const { me, status: meStatus } = useMyMembership(slug);
  const [problems, setProblems] = useState<ProblemWithClaims[]>([]);
  const [loading, setLoading] = useState(true);
  const [lens, setLens] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPropose, setShowPropose] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${slug}/problems`, { cache: "no-store" });
      const data = await res.json();
      setProblems(data.problems ?? []);
    } finally {
      setLoading(false);
    }
  }, [slug]);
  useEffect(() => {
    void load();
  }, [load]);

  const myTeamId = me?.role === "participant" ? me.teamId : null;
  const myProblem = problems.find((p) => p.claimedBy.some((c) => c.id === myTeamId));
  const trackName = (id: string | null) => contest.tracks.find((tr) => tr.id === id)?.name ?? null;
  const trackIcon = (id: string | null) => contest.tracks.find((tr) => tr.id === id)?.icon ?? "🎯";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      if (lens !== "all" && p.trackId !== lens) return false;
      if (!q) return true;
      return [p.title, p.description, p.ownerDepartment, p.metricTemplate?.metric].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [problems, lens, query]);

  const act = async (problemId: string, method: "POST" | "DELETE") => {
    setBusy(problemId);
    setMsg(null);
    try {
      const res = await fetch(`/api/c/${slug}/problems/${problemId}/claim`, { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error ?? "Something went wrong" });
      else setMsg({ ok: true, text: method === "POST" ? "Problem claimed for your crew." : "Problem released." });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const teamWord = t("team");
  const lensWord = t("track");

  return (
    <main className="min-h-screen overflow-x-hidden">
      <BackgroundPattern />
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-14 sm:pt-20">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-300">
          <Lightbulb size={14} className="text-amber-300" /> Problem Bank
        </div>
        <h1 className="text-3xl font-black text-white sm:text-5xl">Pick a problem worth fixing</h1>
        <p className="mt-3 max-w-3xl text-gray-300">
          Every problem is written as a measurable outcome: <em>from X to Y</em>. Claim one for your {teamWord.toLowerCase()}, or
          propose your own. The organisers approve proposals before the Idea Pitch.
        </p>

        {myTeamId && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <Target size={16} className="text-emerald-300" />
            {myProblem ? (
              <span className="text-gray-200">
                Your {teamWord.toLowerCase()} is working on <strong className="text-white">{myProblem.title}</strong>
              </span>
            ) : (
              <span className="text-gray-300">Your {teamWord.toLowerCase()} hasn&apos;t picked a problem yet.</span>
            )}
            <button
              onClick={() => setShowPropose((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <Plus size={14} /> Propose your own
            </button>
          </div>
        )}
        {meStatus === "anon" && (
          <p className="mt-4 text-sm text-gray-400">
            <Link href={`/c/${slug}/dashboard`} className="text-electric-blue underline">
              Sign in
            </Link>{" "}
            and join a {teamWord.toLowerCase()} to claim a problem.
          </p>
        )}
        {msg && (
          <div
            className={`mt-4 rounded-lg border px-4 py-2 text-sm ${
              msg.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-red-500/40 bg-red-500/10 text-red-200"
            }`}
          >
            {msg.text}
          </div>
        )}
        {showPropose && myTeamId && (
          <ProposeForm
            slug={slug}
            tracks={contest.tracks}
            lensWord={lensWord}
            onDone={async (text) => {
              setShowPropose(false);
              setMsg({ ok: true, text });
              await load();
            }}
            onError={(text) => setMsg({ ok: false, text })}
          />
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setLens("all")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              lens === "all" ? "border-white/40 bg-white/15 text-white" : "border-white/15 text-gray-300 hover:bg-white/5"
            }`}
          >
            All {lensWord}s
          </button>
          {contest.tracks.map((tr) => (
            <button
              key={tr.id}
              onClick={() => setLens(tr.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                lens === tr.id ? "border-white/40 bg-white/15 text-white" : "border-white/15 text-gray-300 hover:bg-white/5"
              }`}
            >
              {tr.icon} {tr.name}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search problems"
              className="w-full rounded-md border border-white/15 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-gray-400">No problems here yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visible.map((p) => {
              const mine = p.claimedBy.some((c) => c.id === myTeamId);
              const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.open;
              const claimable =
                !!myTeamId &&
                !mine &&
                p.slotsLeft > 0 &&
                (p.status === "open" || (p.status === "approved" && p.proposedByTeamId === myTeamId));
              return (
                <GlassCard key={p.id} className={`flex flex-col p-5 ${mine ? "border-emerald-400/50" : ""}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-gray-300">
                      {trackIcon(p.trackId)} {trackName(p.trackId) ?? "Any lens"}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 ${badge.cls}`}>{badge.label}</span>
                    {p.ownerDepartment && <span className="text-gray-400">Owner: {p.ownerDepartment}</span>}
                  </div>
                  <h3 className="text-lg font-bold text-white">{p.title}</h3>
                  {p.description && <p className="mt-1 whitespace-pre-line text-sm text-gray-300">{p.description}</p>}
                  {p.metricTemplate && (
                    <div className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                      <span className="font-semibold text-white">Metric:</span> {p.metricTemplate.metric}
                      {p.metricTemplate.unit ? ` (${p.metricTemplate.unit})` : ""} ·{" "}
                      {p.metricTemplate.direction === "decrease" ? "lower is better ↓" : "higher is better ↑"}
                    </div>
                  )}
                  {p.proposedByTeamName && (
                    <p className="mt-2 text-xs text-gray-400">Proposed by {p.proposedByTeamName}</p>
                  )}
                  <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-gray-400">
                    <Users size={14} />
                    {p.claimedBy.length === 0 ? (
                      <span>Not claimed yet</span>
                    ) : (
                      <span>
                        {p.claimedBy.map((c) => (
                          <span key={c.id} className={c.status === "eliminated" ? "line-through opacity-60" : ""}>
                            {c.name}
                          </span>
                        )).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}
                      </span>
                    )}
                    <span className="ml-auto">
                      {p.slotsLeft > 0 ? `${p.slotsLeft} slot${p.slotsLeft === 1 ? "" : "s"} left` : "Full"}
                    </span>
                    {mine ? (
                      <button
                        disabled={busy === p.id}
                        onClick={() => act(p.id, "DELETE")}
                        className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-50"
                      >
                        <XCircle size={14} /> Release
                      </button>
                    ) : claimable ? (
                      <button
                        disabled={busy === p.id}
                        onClick={() => act(p.id, "POST")}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} /> Claim
                      </button>
                    ) : p.status === "proposed" ? (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Clock size={14} /> Pending
                      </span>
                    ) : null}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
        {settings.problemBankEnabled === false && (
          <p className="mt-6 text-sm text-gray-500">The Problem Bank is switched off for this contest.</p>
        )}
      </section>
    </main>
  );
}

function ProposeForm({
  slug,
  tracks,
  lensWord,
  onDone,
  onError,
}: {
  slug: string;
  tracks: Array<{ id: string; name: string; icon: string | null }>;
  lensWord: string;
  onDone: (msg: string) => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const [ownerDepartment, setOwnerDepartment] = useState("");
  const [metric, setMetric] = useState("");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState<"decrease" | "increase">("decrease");
  const [saving, setSaving] = useState(false);
  const input = "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/c/${slug}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          trackId: trackId || null,
          ownerDepartment,
          metricTemplate: metric ? { metric, unit, direction } : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) onError(data.error ?? "Could not submit the proposal");
      else await onDone("Proposal sent. It shows as “Awaiting approval” until an organiser approves it.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-gray-300">Problem (as an outcome: “Cut X from A to B”)</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className={input} maxLength={255} />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-gray-300">What hurts today, and the number that proves it</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={input} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-300">{lensWord}</label>
        <select value={trackId} onChange={(e) => setTrackId(e.target.value)} className={input}>
          {tracks.map((tr) => (
            <option key={tr.id} value={tr.id} className="bg-gray-900">
              {tr.icon} {tr.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-300">Owning department</label>
        <input value={ownerDepartment} onChange={(e) => setOwnerDepartment(e.target.value)} className={input} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-300">Metric (e.g. Admission TAT)</label>
        <input value={metric} onChange={(e) => setMetric(e.target.value)} className={input} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-300">Unit</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="days, %, ₹" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-300">Better is</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value as "decrease" | "increase")} className={input}>
            <option value="decrease" className="bg-gray-900">Lower ↓</option>
            <option value="increase" className="bg-gray-900">Higher ↑</option>
          </select>
        </div>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button
          disabled={saving}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
        >
          {saving ? "Sending…" : "Send proposal"}
        </button>
      </div>
    </form>
  );
}
