"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Expand, Gavel, Lock, Medal, Shrink, Sparkles, Trophy } from "lucide-react";
import { useContest, useContestConfig } from "@/lib/contest-context";
import type { LiveLeaderboardEntry, LivePayload } from "@/lib/live-types";
import { formatClock, remainingSeconds, useLive, useNow } from "@/components/live/useLive";

/**
 * Projector view for the live finale. Public, full-bleed, no chrome (the
 * contest layout hides nav/banner/assistant on /stage). Sized with vw-based
 * clamps so it reads from the back of a hall on 1920×1080 and still fits a
 * laptop screen.
 */
export default function StagePage() {
  const { contest } = useContest();
  const { t, settings } = useContestConfig();
  const { data, error, offset } = useLive(contest.slug, 2000);
  const now = useNow(offset, 250);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const reveal = data?.state.revealStage ?? "hidden";
  const mode: "loading" | "podium" | "standings" | "pitch" | "welcome" = !data
    ? "loading"
    : reveal === "full" && data.leaderboard
      ? "podium"
      : reveal === "partial" && data.leaderboard
        ? "standings"
        : data.current
          ? "pitch"
          : "welcome";

  return (
    <main
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden text-white"
      style={{
        background:
          "var(--stage-bg)", // themed in app/globals.css (dark projector / light symposium)
      }}
    >
      {/* Top bar */}
      <header className="flex shrink-0 items-start justify-between gap-6 px-[4vw] pt-[3vh]">
        <div className="min-w-0">
          <div className="truncate font-black tracking-tight" style={{ fontSize: "clamp(1.25rem, 2.2vw, 3rem)" }}>
            {contest.name}
          </div>
          {settings.theme && (
            <div className="truncate text-white/60" style={{ fontSize: "clamp(0.8rem, 1.1vw, 1.5rem)" }}>
              {settings.theme}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {data?.phase && (
            <div
              className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-semibold text-white/80 sm:block"
              style={{ fontSize: "clamp(0.75rem, 1vw, 1.25rem)" }}
            >
              {t("phase")} {data.phase.phase} · {data.phase.name}
            </div>
          )}
          <div
            className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1.5 font-bold uppercase tracking-widest text-red-300"
            style={{ fontSize: "clamp(0.7rem, 0.9vw, 1.1rem)" }}
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 transition hover:text-white"
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? <Shrink size={18} /> : <Expand size={18} />}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1 flex-col px-[4vw] pb-[3vh]">
        {error && !data && (
          <div className="m-auto text-center text-white/60" style={{ fontSize: "clamp(1rem, 1.5vw, 2rem)" }}>
            {error}
          </div>
        )}
        <AnimatePresence mode="wait">
          {mode === "loading" && !error && (
            <motion.div key="loading" className="m-auto text-white/40" exit={{ opacity: 0 }}>
              Connecting…
            </motion.div>
          )}
          {mode === "welcome" && data && <Welcome key="welcome" data={data} name={contest.name} teamTerm={t("team")} />}
          {mode === "pitch" && data && (
            <Pitch key={`pitch-${data.current!.teamId}`} data={data} now={now} juryTerm={t("judge")} />
          )}
          {mode === "standings" && data && <Standings key="standings" data={data} />}
          {mode === "podium" && data && <Podium key="podium" rows={data.leaderboard ?? []} />}
        </AnimatePresence>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function Welcome({ data, name, teamTerm }: { data: LivePayload; name: string; teamTerm: string }) {
  const order = data.queue.slice(0, 10);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6 }}
      className="m-auto flex w-full max-w-[90vw] flex-col items-center text-center"
    >
      <Sparkles className="mb-4 text-hot-pink" style={{ width: "clamp(2rem, 3vw, 4rem)", height: "clamp(2rem, 3vw, 4rem)" }} />
      <div
        className="bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text font-black leading-none text-transparent"
        style={{ fontSize: "clamp(2.5rem, 7vw, 9rem)" }}
      >
        {data.phase?.name ?? name}
      </div>
      <div className="mt-4 text-white/60" style={{ fontSize: "clamp(1rem, 1.8vw, 2.5rem)" }}>
        {data.phase ? name : "Starting soon"}
      </div>
      {order.length > 0 && (
        <div className="mt-[5vh] w-full max-w-5xl">
          <div className="mb-3 font-semibold uppercase tracking-[0.3em] text-white/40" style={{ fontSize: "clamp(0.7rem, 0.9vw, 1.1rem)" }}>
            {teamTerm} pitch order
          </div>
          <ol className="grid grid-cols-1 gap-x-8 gap-y-2 text-left sm:grid-cols-2">
            {order.map((q, i) => (
              <motion.li
                key={q.teamId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="flex items-baseline gap-3 border-b border-white/5 py-1.5"
                style={{ fontSize: "clamp(0.9rem, 1.3vw, 1.8rem)" }}
              >
                <span className="w-[2ch] shrink-0 text-right font-bold text-white/30 tabular-nums">{i + 1}</span>
                <span className="truncate font-semibold">{q.teamName}</span>
                {q.track && <span className="ml-auto hidden truncate text-white/40 md:inline" style={{ fontSize: "0.7em" }}>{q.track}</span>}
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

function Pitch({ data, now, juryTerm }: { data: LivePayload; now: number; juryTerm: string }) {
  const current = data.current!;
  const endsAt = data.state.timerEndsAt;
  const remaining = remainingSeconds(endsAt, now);
  // Remember the initial duration of each timer so the ring can show progress.
  const [timerMeta, setTimerMeta] = useState<{ endsAt: number; total: number } | null>(null);
  if (endsAt && timerMeta?.endsAt !== endsAt) {
    setTimerMeta({ endsAt, total: Math.max(1, Math.ceil((endsAt - now) / 1000)) });
  }
  const total = timerMeta && timerMeta.endsAt === endsAt ? timerMeta.total : remaining ?? 1;
  const frac = remaining === null ? 0 : Math.min(1, remaining / Math.max(total, 1));

  const idx = data.queue.findIndex((q) => q.teamId === current.teamId);
  const next = idx >= 0 ? data.queue[idx + 1] : undefined;
  const { judgesTotal, judgesScored } = data.progress;
  const urgent = remaining !== null && remaining <= 60;
  const over = remaining === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-[4vw] lg:grid-cols-[1fr_auto]">
        {/* Team */}
        <div className="min-w-0">
          <div className="mb-[2vh] font-semibold uppercase tracking-[0.35em] text-hot-pink" style={{ fontSize: "clamp(0.8rem, 1.2vw, 1.6rem)" }}>
            Now pitching
          </div>
          <h1
            className="break-words font-black leading-[0.95]"
            style={{ fontSize: "clamp(2.75rem, 7.5vw, 10rem)", textShadow: "0 0 60px rgba(124,58,237,0.45)" }}
          >
            {current.teamName}
          </h1>
          {current.track && (
            <div
              className="mt-[2.5vh] inline-flex rounded-full border border-electric-blue/40 bg-electric-blue/15 px-[1.2em] py-[0.35em] font-semibold text-blue-100"
              style={{ fontSize: "clamp(0.9rem, 1.6vw, 2.2rem)" }}
            >
              {current.track}
            </div>
          )}
          {current.headline && (
            <p className="mt-[3vh] line-clamp-3 max-w-[60vw] text-white/70" style={{ fontSize: "clamp(1rem, 1.6vw, 2.2rem)" }}>
              {current.headline}
            </p>
          )}
        </div>

        {/* Timer */}
        {remaining !== null && (
          <div className="flex justify-center lg:justify-end">
            <div className="relative" style={{ width: "clamp(10rem, 22vw, 30rem)", aspectRatio: "1" }}>
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" style={{ stroke: "var(--stage-ring)" }} strokeWidth="6" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={over ? "#ef4444" : urgent ? "#f59e0b" : "url(#stageRing)"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 45}
                  strokeDashoffset={2 * Math.PI * 45 * (1 - frac)}
                  style={{ transition: "stroke-dashoffset 0.25s linear" }}
                />
                <defs>
                  <linearGradient id="stageRing" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="50%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#db2777" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  animate={over ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
                  transition={over ? { duration: 1, repeat: Infinity } : undefined}
                  className={`font-mono font-black tabular-nums ${over ? "text-red-400" : urgent ? "text-amber-300" : "text-white"}`}
                  style={{ fontSize: "clamp(2.5rem, 5.5vw, 7.5rem)" }}
                >
                  {over ? "TIME" : formatClock(remaining)}
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer: jury progress + up next */}
      <div className="mt-[3vh] flex shrink-0 flex-wrap items-end justify-between gap-6 border-t border-white/10 pt-[2.5vh]">
        <div>
          <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-[0.25em] text-white/50" style={{ fontSize: "clamp(0.7rem, 0.95vw, 1.2rem)" }}>
            {data.state.scoringOpen ? (
              <>
                <Gavel size={16} className="text-emerald-300" /> <span className="text-emerald-300">{juryTerm} scoring</span>
              </>
            ) : (
              <>
                <Lock size={14} /> {juryTerm}
              </>
            )}
            {judgesTotal > 0 && (
              <span className="tabular-nums normal-case tracking-normal text-white/60">
                {judgesScored}/{judgesTotal}
              </span>
            )}
          </div>
          {judgesTotal > 0 && (
            <div className="flex flex-wrap gap-[0.6vw]">
              {Array.from({ length: judgesTotal }, (_, i) => {
                const done = i < judgesScored;
                return (
                  <motion.span
                    key={i}
                    initial={false}
                    animate={done ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className={`inline-block rounded-full border-2 ${
                      done ? "border-emerald-300 bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" : "border-white/25 bg-transparent"
                    }`}
                    style={{ width: "clamp(0.8rem, 1.3vw, 1.8rem)", height: "clamp(0.8rem, 1.3vw, 1.8rem)" }}
                  />
                );
              })}
            </div>
          )}
        </div>
        {next && (
          <div className="text-right" style={{ fontSize: "clamp(0.9rem, 1.4vw, 2rem)" }}>
            <div className="font-semibold uppercase tracking-[0.25em] text-white/40" style={{ fontSize: "0.6em" }}>
              Up next
            </div>
            <div className="font-bold text-white/85">{next.teamName}</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

function Standings({ data }: { data: LivePayload }) {
  const rows = (data.leaderboard ?? []).filter((r) => r.rank > 3);
  const hidden = data.hiddenTop || Math.min(3, (data.leaderboard ?? []).length);
  const cols = rows.length > 8 ? "lg:grid-cols-2" : "";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="mb-[3vh] mt-[2vh] text-center font-black" style={{ fontSize: "clamp(1.75rem, 4vw, 5rem)" }}>
        The Standings
      </div>
      {hidden > 0 && (
        <div className="mb-[3vh] grid grid-cols-3 gap-[2vw]">
          {Array.from({ length: hidden }, (_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.15 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 py-[2.5vh]"
            >
              <div className="font-black text-amber-200/80" style={{ fontSize: "clamp(1.5rem, 3.5vw, 4.5rem)" }}>
                ?
              </div>
              <div className="font-semibold uppercase tracking-[0.2em] text-amber-200/60" style={{ fontSize: "clamp(0.6rem, 0.9vw, 1.1rem)" }}>
                Top 3 · revealed soon
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <ol className={`grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-x-[3vw] gap-y-[1vh] overflow-y-auto ${cols}`}>
        {rows.map((r, i) => (
          <motion.li
            key={r.teamId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.06 }}
            className="flex items-center gap-[1.5vw] rounded-xl border border-white/10 bg-white/5 px-[1.5vw] py-[1.2vh]"
            style={{ fontSize: "clamp(0.95rem, 1.5vw, 2.1rem)" }}
          >
            <span className="w-[2.5ch] shrink-0 text-right font-black text-white/40 tabular-nums">{r.rank}</span>
            <span className="min-w-0 flex-1 truncate font-bold">{r.teamName}</span>
            {r.track && <span className="hidden max-w-[30%] truncate text-white/40 md:inline" style={{ fontSize: "0.7em" }}>{r.track}</span>}
            <span className="shrink-0 font-black tabular-nums text-white/90">{r.totalScore.toFixed(1)}</span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

const PODIUM_CFG = {
  1: { h: "100%", delay: 2.2, Icon: Crown, grad: "from-amber-300 via-yellow-400 to-amber-600", text: "text-amber-200", label: "Winner" },
  2: { h: "74%", delay: 1.2, Icon: Medal, grad: "from-slate-200 via-slate-300 to-slate-500", text: "text-slate-200", label: "2nd" },
  3: { h: "56%", delay: 0.3, Icon: Trophy, grad: "from-amber-600 via-orange-700 to-amber-900", text: "text-orange-200", label: "3rd" },
} as const;

function Podium({ rows }: { rows: LiveLeaderboardEntry[] }) {
  const top = (rank: 1 | 2 | 3) => rows.find((r) => r.rank === rank);
  const rest = rows.filter((r) => r.rank > 3).slice(0, 12);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-[1vh] text-center font-black"
        style={{ fontSize: "clamp(1.75rem, 4vw, 5rem)" }}
      >
        And the winners are…
      </motion.div>

      <div className="relative mx-auto grid min-h-0 w-full max-w-[80vw] flex-1 grid-cols-3 items-end gap-[2vw] pt-[2vh]" style={{ minHeight: "38vh" }}>
        {Array.from({ length: 12 }, (_, i) => (
          <motion.span
            key={`spark-${i}`}
            aria-hidden
            className="pointer-events-none absolute rounded-full bg-amber-300"
            style={{ left: `${(i * 37) % 100}%`, bottom: 0, width: 6, height: 6 }}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], y: [0, -300 - (i % 4) * 60] }}
            transition={{ delay: 2.6 + (i % 6) * 0.15, duration: 2.4, repeat: Infinity, repeatDelay: 1.5 + (i % 3) }}
          />
        ))}
        {([2, 1, 3] as const).map((rank) => {
          const r = top(rank);
          const cfg = PODIUM_CFG[rank];
          return (
            <div key={rank} className="flex h-full min-w-0 flex-col items-center justify-end">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: cfg.delay + 0.7, duration: 0.6, type: "spring" }}
                className="mb-[1.5vh] w-full min-w-0 text-center"
              >
                <cfg.Icon
                  className={`mx-auto ${cfg.text}`}
                  style={{ width: rank === 1 ? "clamp(2rem, 4vw, 5rem)" : "clamp(1.5rem, 2.6vw, 3.5rem)", height: "auto" }}
                />
                <div
                  className="mt-1 break-words font-black leading-tight"
                  style={{ fontSize: rank === 1 ? "clamp(1.1rem, 3vw, 4rem)" : "clamp(0.95rem, 2.1vw, 2.8rem)" }}
                >
                  {r?.teamName ?? "—"}
                </div>
                {r?.track && (
                  <div className="truncate text-white/50" style={{ fontSize: "clamp(0.7rem, 1.1vw, 1.5rem)" }}>
                    {r.track}
                  </div>
                )}
              </motion.div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: cfg.h }}
                transition={{ delay: cfg.delay, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                className={`relative flex w-full flex-col items-center justify-start overflow-hidden rounded-t-2xl bg-gradient-to-b ${cfg.grad} pt-[1.5vh]`}
                style={{ maxHeight: "34vh", boxShadow: rank === 1 ? "0 0 80px rgba(251,191,36,0.45)" : undefined }}
              >
                <div className="font-black text-black/70" style={{ fontSize: "clamp(1.5rem, 4vw, 5.5rem)" }}>
                  {rank}
                </div>
                {r && (
                  <div className="font-bold tabular-nums text-black/60" style={{ fontSize: "clamp(0.8rem, 1.5vw, 2rem)" }}>
                    {r.totalScore.toFixed(1)}
                  </div>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <motion.ol
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.2 }}
          className="mx-auto mt-[2.5vh] grid w-full max-w-[85vw] shrink-0 grid-cols-2 gap-x-[3vw] gap-y-[0.6vh] lg:grid-cols-3"
          style={{ fontSize: "clamp(0.75rem, 1.1vw, 1.5rem)" }}
        >
          {rest.map((r) => (
            <li key={r.teamId} className="flex items-center gap-2 border-b border-white/5 py-1 text-white/70">
              <span className="w-[2.5ch] shrink-0 text-right font-bold text-white/35 tabular-nums">{r.rank}</span>
              <span className="min-w-0 flex-1 truncate">{r.teamName}</span>
              <span className="shrink-0 tabular-nums">{r.totalScore.toFixed(1)}</span>
            </li>
          ))}
        </motion.ol>
      )}
    </motion.div>
  );
}
