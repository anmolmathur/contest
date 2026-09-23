"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Eye,
  EyeOff,
  Gavel,
  ListOrdered,
  Lock,
  MonitorPlay,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  Timer,
  Trophy,
  Unlock,
  X,
} from "lucide-react";
import BackgroundPattern from "@/components/BackgroundPattern";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { scorablePhases } from "@/lib/scoring";
import type { LivePutBody, LiveTeamRef } from "@/lib/live-types";
import { formatClock, remainingSeconds, useLive, useMyRole, useNow } from "@/components/live/useLive";

const CARD = "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md";
const BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
const BTN_GHOST = `${BTN} border-white/15 bg-white/5 text-gray-200 hover:bg-white/10`;

export default function LiveControlPage() {
  const { contest } = useContest();
  const role = useMyRole(contest.slug);

  if (role === null) {
    return (
      <main className="min-h-screen">
        <BackgroundPattern />
        <div className="py-32 text-center text-gray-400">Checking access…</div>
      </main>
    );
  }
  if (role !== "admin") {
    return (
      <main className="min-h-screen">
        <BackgroundPattern />
        <div className="mx-auto mt-24 max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <Lock className="mx-auto mb-3 text-gray-500" size={36} />
          <h1 className="text-lg font-bold text-white">Live control room is for contest admins</h1>
          <p className="mt-2 text-sm text-gray-400">
            Looking for the audience view? Open the{" "}
            <Link href={`/c/${contest.slug}/stage`} className="text-electric-blue underline">
              stage screen
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }
  return <ControlRoom />;
}

function ControlRoom() {
  const { contest } = useContest();
  const { t, tp, isSymposium } = useContestConfig();
  const slug = contest.slug;
  const { data, error, offset, send } = useLive(slug, 2000);
  const now = useNow(offset, 500);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftQueue, setDraftQueue] = useState<string[] | null>(null);
  const [customMin, setCustomMin] = useState("5");

  const phases = useMemo(() => scorablePhases(contest.phaseConfig), [contest.phaseConfig]);
  const frozen = contest.status === "completed" || contest.status === "archived";

  const act = async (body: LivePutBody, key: string = body.action) => {
    setBusy(key);
    const err = await send(body);
    setBusy(null);
    setActionError(err);
    return err;
  };

  const teams = useMemo(() => data?.teams ?? [], [data?.teams]);
  const teamById = useMemo(() => new Map(teams.map((tm) => [tm.teamId, tm])), [teams]);
  const serverQueue = data?.state.queue ?? [];
  const queue = draftQueue ?? serverQueue;
  const queueDirty = draftQueue !== null;
  const available = teams.filter((tm) => !queue.includes(tm.teamId));
  const state = data?.state;
  const current = data?.current ?? null;
  const currentIdx = state?.currentTeamId ? serverQueue.indexOf(state.currentTeamId) : -1;
  const nextTeam = serverQueue[currentIdx + 1] ? teamById.get(serverQueue[currentIdx + 1]) : undefined;
  const remaining = remainingSeconds(state?.timerEndsAt ?? null, now);

  const timerPresets = isSymposium
    ? [
        { label: "Pitch", seconds: 7 * 60 },
        { label: "Q&A", seconds: 3 * 60 },
      ]
    : [
        { label: "Demo", seconds: 5 * 60 },
        { label: "Q&A", seconds: 3 * 60 },
      ];

  const editQueue = (fn: (q: string[]) => string[]) => setDraftQueue(fn([...queue]));
  const move = (i: number, d: -1 | 1) =>
    editQueue((q) => {
      const j = i + d;
      if (j < 0 || j >= q.length) return q;
      [q[i], q[j]] = [q[j], q[i]];
      return q;
    });

  const progress = data?.progress;
  const judgesTotal = progress?.judgesTotal ?? 0;

  return (
    <main className="min-h-screen pb-16 text-white">
      <BackgroundPattern />

      {/* Header */}
      <div className="border-b border-white/10 bg-black/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live control room
            </div>
            <h1 className="truncate text-xl font-bold sm:text-2xl">{contest.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/c/${slug}/stage`} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
              <MonitorPlay size={16} /> Open stage <ExternalLink size={12} />
            </a>
            <a href={`/c/${slug}/jury`} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
              <Gavel size={16} /> {t("judge")} view <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-4 pt-4">
        {frozen && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
            This contest is {contest.status}; the live state is read-only.
          </div>
        )}
        {(actionError || error) && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            <span>{actionError ?? error}</span>
            {actionError && (
              <button onClick={() => setActionError(null)} aria-label="Dismiss" className="shrink-0">
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Round picker */}
        <section className={`${CARD} p-4`}>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Live {t("phase").toLowerCase()}</div>
          {phases.length === 0 ? (
            <p className="text-sm text-gray-400">No scorable {tp("phase").toLowerCase()} are configured.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {phases.map((p) => {
                const active = state?.phase === p.phase;
                return (
                  <button
                    key={p.phase}
                    disabled={frozen || !!busy || active}
                    onClick={() => act({ action: "setPhase", phase: p.phase })}
                    className={`${BTN} ${
                      active
                        ? "border-neon-purple bg-neon-purple/30 text-white disabled:opacity-100"
                        : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    {t("phase")} {p.phase} · {p.name}
                    <span className="text-xs font-normal text-gray-400">{p.maxPoints} pts</span>
                  </button>
                );
              })}
            </div>
          )}
          {state && state.phase === null && phases.length > 0 && (
            <p className="mt-2 text-xs text-amber-300">Pick the {t("phase").toLowerCase()} being pitched live before putting a {t("team").toLowerCase()} on stage.</p>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* ---------------- Left: now pitching ---------------- */}
          <div className="space-y-4 lg:col-span-3">
            <section className={`${CARD} overflow-hidden`}>
              <div className="h-1 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink" />
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">Now pitching</div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      state?.scoringOpen
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                        : "border-white/15 bg-white/5 text-gray-400"
                    }`}
                  >
                    {state?.scoringOpen ? <Unlock size={12} /> : <Lock size={12} />}
                    Scoring {state?.scoringOpen ? "open" : "closed"}
                  </span>
                </div>

                {current ? (
                  <>
                    <h2 className="mt-2 break-words text-3xl font-black sm:text-4xl">{current.teamName}</h2>
                    {current.track && <div className="mt-1 text-sm text-electric-blue">{current.track}</div>}
                    {current.headline && <p className="mt-3 line-clamp-3 text-sm text-gray-300">{current.headline}</p>}
                  </>
                ) : (
                  <p className="mt-3 text-gray-400">
                    Nobody on stage. Build the queue and press <b>Start first {t("team").toLowerCase()}</b>, or pick a{" "}
                    {t("team").toLowerCase()} from the queue.
                  </p>
                )}

                {/* timer + progress */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Timer size={12} /> Timer
                    </div>
                    <div
                      className={`mt-1 font-mono text-3xl font-black tabular-nums sm:text-4xl ${
                        remaining === null ? "text-gray-600" : remaining === 0 ? "text-red-400" : remaining <= 60 ? "text-amber-300" : "text-white"
                      }`}
                    >
                      {remaining === null ? "--:--" : formatClock(remaining)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Gavel size={12} /> {t("judge")} scored
                    </div>
                    <div className="mt-1 text-3xl font-black tabular-nums sm:text-4xl">
                      {current ? progress?.judgesScored ?? 0 : 0}
                      <span className="text-lg text-gray-500">/{judgesTotal}</span>
                    </div>
                    {current && (progress?.scoresCount ?? 0) > (progress?.judgesScored ?? 0) && (
                      <div className="text-[11px] text-gray-500">
                        +{(progress?.scoresCount ?? 0) - (progress?.judgesScored ?? 0)} admin score(s)
                      </div>
                    )}
                  </div>
                </div>

                {data?.judges && data.judges.length > 0 && current && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {data.judges.map((j) => (
                      <span
                        key={j.id}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                          j.scored
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                            : "border-white/10 bg-white/5 text-gray-400"
                        }`}
                      >
                        {j.scored ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                        {j.name ?? "Unnamed"}
                      </span>
                    ))}
                  </div>
                )}

                {/* primary controls */}
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {state?.scoringOpen ? (
                    <button
                      disabled={frozen || !!busy}
                      onClick={() => act({ action: "closeScoring" })}
                      className={`${BTN} border-amber-400/40 bg-amber-500/20 py-3 text-amber-100 hover:bg-amber-500/30`}
                    >
                      <Lock size={16} /> Close scoring
                    </button>
                  ) : (
                    <button
                      disabled={frozen || !!busy || !current}
                      onClick={() => act({ action: "openScoring" })}
                      className={`${BTN} border-emerald-400/40 bg-emerald-500/20 py-3 text-emerald-100 hover:bg-emerald-500/30`}
                    >
                      <Unlock size={16} /> Open scoring
                    </button>
                  )}
                  <button
                    disabled={frozen || !!busy || serverQueue.length === 0 || (!!state?.currentTeamId && !nextTeam) || state?.phase == null}
                    onClick={() => act({ action: "next" })}
                    className={`${BTN} border-neon-purple/50 bg-neon-purple/30 py-3 text-white hover:bg-neon-purple/40`}
                  >
                    {state?.currentTeamId ? (
                      <>
                        Next: <span className="min-w-0 truncate">{nextTeam?.teamName ?? "end of queue"}</span> <ChevronRight size={16} />
                      </>
                    ) : (
                      <>
                        <Play size={16} /> Start first {t("team").toLowerCase()}
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {timerPresets.map((p) => (
                    <button
                      key={p.label}
                      disabled={frozen || !!busy}
                      onClick={() => act({ action: "startTimer", seconds: p.seconds }, `timer-${p.label}`)}
                      className={BTN_GHOST}
                    >
                      <Timer size={14} /> {p.label} {formatClock(p.seconds)}
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={customMin}
                      onChange={(e) => setCustomMin(e.target.value)}
                      className="w-16 rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-white"
                      aria-label="Custom timer minutes"
                    />
                    <button
                      disabled={frozen || !!busy || !(Number(customMin) > 0)}
                      onClick={() => act({ action: "startTimer", seconds: Math.round(Number(customMin) * 60) }, "timer-custom")}
                      className={BTN_GHOST}
                    >
                      min
                    </button>
                  </div>
                  <button
                    disabled={frozen || !!busy || !state?.timerEndsAt}
                    onClick={() => act({ action: "clearTimer" })}
                    className={BTN_GHOST}
                  >
                    <X size={14} /> Clear
                  </button>
                </div>
              </div>
            </section>

            {/* Reveal */}
            <section className={`${CARD} p-5`}>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                <Trophy size={14} /> Stage results reveal
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { stage: "hidden", label: "Hidden", hint: "No scores on stage", Icon: EyeOff },
                    { stage: "partial", label: "Ranks 4+", hint: "Top 3 kept secret", Icon: Eye },
                    { stage: "full", label: "Podium", hint: "Reveal the winners", Icon: Trophy },
                  ] as const
                ).map(({ stage, label, hint, Icon }) => {
                  const active = state?.revealStage === stage;
                  return (
                    <button
                      key={stage}
                      disabled={frozen || !!busy || active}
                      onClick={() => {
                        if (stage === "full" && !window.confirm("Reveal the podium on the stage screen?")) return;
                        void act({ action: "reveal", revealStage: stage }, `reveal-${stage}`);
                      }}
                      className={`${BTN} flex-col py-3 ${
                        active
                          ? "border-hot-pink bg-hot-pink/25 text-white disabled:opacity-100"
                          : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                      <span className="hidden text-[11px] font-normal text-gray-400 sm:block">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Leaderboard preview */}
            <section className={`${CARD} p-5`}>
              <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-400">
                <span>Standings (admin preview)</span>
                {data?.phase && <span className="normal-case tracking-normal">{t("phase")} {data.phase.phase} / total</span>}
              </div>
              {!data?.leaderboard || data.leaderboard.length === 0 ? (
                <p className="text-sm text-gray-500">No approved {tp("team").toLowerCase()} yet.</p>
              ) : (
                <ol className="divide-y divide-white/5">
                  {data.leaderboard.slice(0, 12).map((r) => (
                    <li key={r.teamId} className="flex items-center gap-3 py-2 text-sm">
                      <span className={`w-6 shrink-0 text-right font-bold ${r.rank <= 3 ? "text-amber-300" : "text-gray-500"}`}>{r.rank}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {r.teamName}
                        {r.track && <span className="ml-2 text-xs text-gray-500">{r.track}</span>}
                      </span>
                      {data.phase && (
                        <span className="w-14 shrink-0 text-right tabular-nums text-gray-400">{r.phaseScore.toFixed(1)}</span>
                      )}
                      <span className="w-14 shrink-0 text-right font-semibold tabular-nums">{r.totalScore.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          {/* ---------------- Right: queue ---------------- */}
          <div className="space-y-4 lg:col-span-2">
            <section className={`${CARD} p-5`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  <ListOrdered size={14} /> Pitch order
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      editQueue((q) => {
                        for (let i = q.length - 1; i > 0; i--) {
                          const j = Math.floor(Math.random() * (i + 1));
                          [q[i], q[j]] = [q[j], q[i]];
                        }
                        return q;
                      })
                    }
                    disabled={frozen || queue.length < 2}
                    className={`${BTN_GHOST} px-2 py-1 text-xs`}
                    title="Shuffle"
                  >
                    <Shuffle size={13} />
                  </button>
                </div>
              </div>

              {queue.length === 0 ? (
                <p className="text-sm text-gray-500">Queue is empty — add {tp("team").toLowerCase()} below.</p>
              ) : (
                <ol className="space-y-1.5">
                  {queue.map((id, i) => {
                    const tm = teamById.get(id);
                    const isCurrent = state?.currentTeamId === id;
                    const done = !queueDirty && currentIdx >= 0 && i < currentIdx;
                    return (
                      <li
                        key={id}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                          isCurrent ? "border-neon-purple/60 bg-neon-purple/15" : "border-white/10 bg-black/20"
                        } ${done ? "opacity-50" : ""}`}
                      >
                        <span className="w-5 shrink-0 text-center text-xs font-bold text-gray-500">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {tm?.teamName ?? "Unknown"}
                            {isCurrent && <span className="ml-2 text-[10px] font-bold uppercase text-hot-pink">on stage</span>}
                          </div>
                          {tm?.track && <div className="truncate text-[11px] text-gray-500">{tm.track}</div>}
                        </div>
                        <button onClick={() => move(i, -1)} disabled={frozen || i === 0} className="p-1 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Move up">
                          <ArrowUp size={14} />
                        </button>
                        <button onClick={() => move(i, 1)} disabled={frozen || i === queue.length - 1} className="p-1 text-gray-400 hover:text-white disabled:opacity-30" aria-label="Move down">
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => editQueue((q) => q.filter((x) => x !== id))}
                          disabled={frozen}
                          className="p-1 text-gray-400 hover:text-red-300 disabled:opacity-30"
                          aria-label="Remove"
                        >
                          <X size={14} />
                        </button>
                        <button
                          onClick={() => act({ action: "setCurrent", teamId: id }, `current-${id}`)}
                          disabled={frozen || !!busy || isCurrent || state?.phase == null}
                          className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-30"
                          title="Put on stage now"
                        >
                          Live
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}

              {queueDirty && (
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={frozen || !!busy}
                    onClick={async () => {
                      const err = await act({ action: "setQueue", queue });
                      if (!err) setDraftQueue(null);
                    }}
                    className={`${BTN} flex-1 border-electric-blue/50 bg-electric-blue/25 text-white hover:bg-electric-blue/35`}
                  >
                    Save order
                  </button>
                  <button onClick={() => setDraftQueue(null)} className={BTN_GHOST}>
                    Discard
                  </button>
                </div>
              )}
            </section>

            <section className={`${CARD} p-5`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Approved {tp("team").toLowerCase()} ({available.length})
                </div>
                <button
                  disabled={frozen || available.length === 0}
                  onClick={() => editQueue((q) => [...q, ...available.map((a) => a.teamId)])}
                  className={`${BTN_GHOST} px-2 py-1 text-xs`}
                >
                  <Plus size={13} /> Add all
                </button>
              </div>
              {available.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {teams.length === 0 ? `No approved ${tp("team").toLowerCase()} yet.` : "Everyone is in the queue."}
                </p>
              ) : (
                <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {available.map((tm: LiveTeamRef) => (
                    <li key={tm.teamId} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{tm.teamName}</div>
                        {tm.track && <div className="truncate text-[11px] text-gray-500">{tm.track}</div>}
                      </div>
                      <button
                        disabled={frozen}
                        onClick={() => editQueue((q) => [...q, tm.teamId])}
                        className="rounded-md border border-white/15 p-1 text-gray-300 hover:bg-white/10"
                        aria-label={`Add ${tm.teamName}`}
                      >
                        <Plus size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`${CARD} p-5`}>
              <button
                disabled={frozen || !!busy}
                onClick={() => {
                  if (window.confirm("Reset the live state? The queue, current team, timer and reveal will be cleared (scores are kept).")) {
                    void act({ action: "reset" });
                    setDraftQueue(null);
                  }
                }}
                className={`${BTN} w-full border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20`}
              >
                <RotateCcw size={14} /> Reset live state
              </button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
