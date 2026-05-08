"use client";

/**
 * Public results hub.
 *
 * Renders three shapes of the same page based on `contest.status`:
 *   - active     → "Live Leaderboard" with a pulsing red dot, auto-refresh
 *                  every 30s, "updated Xs ago" ticker, current-phase strip.
 *   - completed  → "Final Results" with gold shimmer on 1st place, no refresh.
 *   - archived   → "Results (archived)" — same as completed, muted palette.
 *   - draft      → minimal teaser; leaderboard empty.
 *
 * Deliberately public: middleware allowlists /c/[slug]/results and the
 * leaderboard API needs no auth, so this page works as an evergreen
 * shareable link for marketing / recruiting / past-contest showcase.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, Radio, Award, Medal, Crown, Share2, Link as LinkIcon,
  Search, ChevronLeft, RefreshCw, Zap, CheckCircle2,
} from "lucide-react";
import { useContest } from "@/lib/contest-context";

type LBEntry = {
  teamId: string;
  teamName: string;
  track: string | null;
  trackId: string | null;
  leaderId: string | null;
  phaseScores: Record<string, number>;
  totalScore: number;
  members: Array<{ id?: string; name?: string | null; isLeader?: boolean }>;
};

type PhaseConfig = {
  phase: number;
  name: string;
  maxPoints: number;
  startDate?: string;
  endDate?: string;
};

type LBResponse = {
  leaderboard: LBEntry[];
  scoringCriteria?: unknown[];
  phaseConfig?: PhaseConfig[];
};

// ------- helpers ------------------------------------------------------------

/** "12s ago", "3m ago", "2h ago" */
function relativeTime(from: Date, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** initials for a member avatar */
function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-red-500/15 border border-red-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400">
        <span
          className="inline-block h-2 w-2 rounded-full bg-red-500"
          style={{ animation: "pulseDot 1.4s ease-in-out infinite" }}
        />
        LIVE
      </div>
    );
  }
  if (status === "completed") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
        <Trophy size={12} /> FINAL
      </div>
    );
  }
  if (status === "archived") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-slate-500/15 border border-slate-400/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
        ARCHIVED
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-yellow-500/15 border border-yellow-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-400">
      DRAFT
    </div>
  );
}

// ------- page ---------------------------------------------------------------

export default function ResultsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { contest } = useContest();

  const [leaderboard, setLeaderboard] = useState<LBEntry[]>([]);
  const [phaseConfig, setPhaseConfig] = useState<PhaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const isLive = contest.status === "active";
  const isCompleted = contest.status === "completed" || contest.status === "archived";

  // -------- Data fetch ----------------------------------------------------
  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/c/${slug}/leaderboard`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as LBResponse;
        setLeaderboard(data.leaderboard);
        setPhaseConfig(data.phaseConfig ?? []);
        setLastUpdated(new Date());
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    if (!isLive) return; // completed/archived results don't change
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, isLive]);

  // Ticker so "updated Xs ago" actually updates in the UI every second.
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // -------- Derived data --------------------------------------------------
  const tracks = useMemo(() => {
    const set = new Set<string>();
    leaderboard.forEach((t) => t.track && set.add(t.track));
    return Array.from(set).sort();
  }, [leaderboard]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaderboard.filter((t) => {
      if (trackFilter !== "all" && t.track !== trackFilter) return false;
      if (!q) return true;
      const hay = [t.teamName, t.track, ...t.members.map((m) => m.name ?? "")]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [leaderboard, search, trackFilter]);

  const podium = filtered.slice(0, 3);
  const others = filtered.slice(3);

  const maxPossible = useMemo(
    () => phaseConfig.reduce((s, p) => s + p.maxPoints, 0) || 100,
    [phaseConfig],
  );

  // Phase-scoring progress bar: what fraction of teams have received any score
  // in each phase. A pragmatic completion heuristic for a live broadcast.
  const phaseProgress = useMemo(() => {
    if (leaderboard.length === 0 || phaseConfig.length === 0) return [];
    return phaseConfig.map((p) => {
      const key = `phase${p.phase}`;
      const scored = leaderboard.filter((t) => (t.phaseScores[key] ?? 0) > 0).length;
      const pct = Math.round((scored / leaderboard.length) * 100);
      return { phase: p.phase, name: p.name, maxPoints: p.maxPoints, pct, scoredCount: scored };
    });
  }, [leaderboard, phaseConfig]);

  const currentPhase = useMemo(() => {
    // Current phase = first with progress < 100 (for live). For completed → null.
    if (!isLive) return null;
    const pending = phaseProgress.find((p) => p.pct < 100);
    return pending ?? phaseProgress[phaseProgress.length - 1] ?? null;
  }, [phaseProgress, isLive]);

  const stats = useMemo(() => {
    const totalScored = leaderboard.reduce((s, t) => s + (t.totalScore > 0 ? 1 : 0), 0);
    const avg = leaderboard.length
      ? leaderboard.reduce((s, t) => s + t.totalScore, 0) / leaderboard.length
      : 0;
    const leader = leaderboard[0];
    return {
      teams: leaderboard.length,
      scoredTeams: totalScored,
      avgScore: avg,
      leaderScore: leader?.totalScore ?? 0,
    };
  }, [leaderboard]);

  // -------- Share ---------------------------------------------------------
  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `${contest.name} — ${isLive ? "Live Leaderboard" : "Results"}`;
    try {
      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav && typeof (nav as Navigator).share === "function") {
        await (nav as Navigator).share({ title, url });
        setShareStatus("Shared!");
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(url);
        setShareStatus("Link copied");
      } else {
        setShareStatus("Could not share");
      }
    } catch {
      setShareStatus("Could not share");
    }
    setTimeout(() => setShareStatus(null), 2000);
  }

  // ------------------------------------------------------------------------

  return (
    <main
      className="min-h-screen text-slate-100"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(124,58,237,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(37,99,235,0.12), transparent 60%), #05060d",
      }}
    >
      {/* ---------------- HEADER ---------------- */}
      <header className="border-b border-white/5 backdrop-blur-md sticky top-0 z-30 bg-slate-950/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href={`/c/${slug}`}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ChevronLeft size={16} /> Back to contest
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
              title="Refresh now"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {isLive ? "Auto-refresh on" : "Refresh"}
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              <Share2 size={14} /> {shareStatus ?? "Share"}
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden px-6 pt-14 pb-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl"
        >
          <div className="flex items-center justify-center gap-3">
            <StatusBadge status={contest.status} />
            {currentPhase && (
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-slate-300">
                <Zap size={12} className="text-amber-300" />
                Phase {currentPhase.phase} — {currentPhase.name}
              </div>
            )}
          </div>

          <h1
            className="mt-5 text-4xl md:text-6xl font-black bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(90deg,
                var(--brand-primary, #a78bfa),
                var(--brand-secondary, #60a5fa),
                var(--brand-accent, #f472b6))`,
            }}
          >
            {isLive ? "Live Leaderboard" : isCompleted ? "Final Results" : "Results"}
          </h1>

          <p className="mt-3 text-lg text-slate-300">{contest.name}</p>

          {lastUpdated && (
            <p className="mt-3 text-xs text-slate-400">
              {isLive ? "Live · " : ""}Updated {relativeTime(lastUpdated, now)}
              {isLive && " · refreshing every 30s"}
            </p>
          )}
        </motion.div>
      </section>

      {/* ---------------- TOP STATS ---------------- */}
      {!loading && leaderboard.length > 0 && (
        <section className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <StatCard icon={<Users size={18} />} label="Teams Competing" value={stats.teams} />
            <StatCard
              icon={<CheckCircle2 size={18} />}
              label="Teams With Scores"
              value={`${stats.scoredTeams} / ${stats.teams}`}
            />
            <StatCard
              icon={<Medal size={18} />}
              label="Leader"
              value={stats.leaderScore.toFixed(1)}
              subtitle={leaderboard[0]?.teamName}
            />
            <StatCard
              icon={<Award size={18} />}
              label="Avg Score"
              value={stats.avgScore.toFixed(1)}
              subtitle={`of ${maxPossible} max`}
            />
          </motion.div>
        </section>
      )}

      {/* ---------------- PHASE PROGRESS ---------------- */}
      {phaseProgress.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Phase Progress
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {phaseProgress.map((p, idx) => (
              <motion.div
                key={p.phase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * idx }}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Phase {p.phase}</span>
                  <span>{p.pct}%</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-white line-clamp-1">{p.name}</div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${p.pct}%`,
                      background:
                        "linear-gradient(90deg, var(--brand-primary, #a78bfa), var(--brand-secondary, #60a5fa))",
                      transition: "width 600ms ease",
                    }}
                  />
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {p.scoredCount} of {leaderboard.length} teams scored · {p.maxPoints} pts max
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- PODIUM ---------------- */}
      {!loading && podium.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-6 text-center">
            {isLive ? "Current Top 3" : "Winners"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-5">
            {/* ordering: 2nd, 1st (center elevated), 3rd */}
            {[podium[1], podium[0], podium[2]].map((team, visualIdx) =>
              team ? (
                <PodiumCard
                  key={team.teamId}
                  team={team}
                  rank={visualIdx === 1 ? 1 : visualIdx === 0 ? 2 : 3}
                  elevated={visualIdx === 1}
                  maxPossible={maxPossible}
                />
              ) : (
                <div key={`ph-${visualIdx}`} />
              )
            )}
          </div>
        </section>
      )}

      {/* ---------------- FILTERS + TABLE ---------------- */}
      <section className="mx-auto max-w-7xl px-6 mt-14 pb-20">
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 flex-1">
            Full Standings
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team, member, track…"
              className="w-full sm:w-72 rounded-md border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
          {tracks.length > 0 && (
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">All tracks</option>
              {tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            Loading leaderboard…
          </div>
        ) : leaderboard.length === 0 ? (
          <EmptyState status={contest.status} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04] text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3 hidden md:table-cell">Track</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Members</th>
                    {phaseConfig.map((p) => (
                      <th key={p.phase} className="px-4 py-3 hidden sm:table-cell text-right">
                        P{p.phase}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {others.map((team, idx) => (
                      <motion.tr
                        key={team.teamId}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-white/5 hover:bg-white/[0.04]"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-400">#{idx + 4}</td>
                        <td className="px-4 py-3 font-semibold text-white">{team.teamName}</td>
                        <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                          {team.track ?? "—"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <MemberAvatars members={team.members} />
                        </td>
                        {phaseConfig.map((p) => (
                          <td
                            key={p.phase}
                            className="px-4 py-3 text-right text-slate-300 hidden sm:table-cell tabular-nums"
                          >
                            {(team.phaseScores[`phase${p.phase}`] ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-bold tabular-nums">
                          {team.totalScore.toFixed(1)}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Shared keyframes. Colocated so the page is self-contained. */}
      <style jsx global>{`
        @keyframes pulseDot {
          0%   { box-shadow: 0 0 0 0    rgba(239,68,68,0.7); }
          70%  { box-shadow: 0 0 0 8px  rgba(239,68,68,0);   }
          100% { box-shadow: 0 0 0 0    rgba(239,68,68,0);   }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .gold-shimmer {
          background: linear-gradient(90deg,
            rgba(251,191,36,0.15) 0%,
            rgba(251,191,36,0.45) 45%,
            rgba(253,224,71,0.75) 50%,
            rgba(251,191,36,0.45) 55%,
            rgba(251,191,36,0.15) 100%);
          background-size: 200% 100%;
          animation: shimmer 6s linear infinite;
        }
        @keyframes floaty {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
      `}</style>
    </main>
  );
}

// ------- subcomponents ------------------------------------------------------

function StatCard({
  icon, label, value, subtitle,
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {subtitle && <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">{subtitle}</div>}
    </div>
  );
}

function MemberAvatars({ members }: { members: LBEntry["members"] }) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((m, i) => (
          <div
            key={m.id ?? i}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 text-[11px] font-bold text-white"
            style={{
              background: `linear-gradient(135deg, hsl(${(i * 57) % 360} 70% 50%), hsl(${(i * 57 + 40) % 360} 70% 40%))`,
            }}
            title={m.name ?? "Member"}
          >
            {initials(m.name)}
          </div>
        ))}
      </div>
      {extra > 0 && <span className="ml-2 text-xs text-slate-400">+{extra}</span>}
    </div>
  );
}

function PodiumCard({
  team, rank, elevated, maxPossible,
}: {
  team: LBEntry; rank: 1 | 2 | 3; elevated: boolean; maxPossible: number;
}) {
  const cfg = {
    1: {
      label: "1st Place",
      Icon: Crown,
      gradient: "from-amber-400/30 via-yellow-400/20 to-amber-600/10",
      ring: "ring-2 ring-amber-400/40",
      heightCls: "md:pb-12",
      numberCls: "text-5xl md:text-7xl",
      shimmer: true,
    },
    2: {
      label: "2nd Place",
      Icon: Medal,
      gradient: "from-slate-300/20 via-slate-200/10 to-slate-500/10",
      ring: "ring-1 ring-slate-400/30",
      heightCls: "md:pb-4",
      numberCls: "text-4xl md:text-5xl",
      shimmer: false,
    },
    3: {
      label: "3rd Place",
      Icon: Award,
      gradient: "from-amber-700/20 via-amber-600/10 to-amber-900/10",
      ring: "ring-1 ring-amber-600/30",
      heightCls: "md:pb-4",
      numberCls: "text-4xl md:text-5xl",
      shimmer: false,
    },
  }[rank];

  const pct = Math.min(100, Math.round((team.totalScore / maxPossible) * 100));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: rank === 1 ? 0.1 : rank === 2 ? 0 : 0.2 }}
      className={`relative ${elevated ? "md:-translate-y-6" : ""} ${cfg.heightCls}`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 ${cfg.ring} bg-gradient-to-b ${cfg.gradient} p-6`}
      >
        {cfg.shimmer && (
          <div className="pointer-events-none absolute inset-0 gold-shimmer opacity-50" />
        )}

        <div className="relative flex items-center gap-3 text-xs uppercase tracking-widest text-slate-200">
          <cfg.Icon size={14} /> {cfg.label}
        </div>

        <div className="relative mt-4">
          <div
            className="inline-block"
            style={rank === 1 ? { animation: "floaty 3s ease-in-out infinite" } : undefined}
          >
            <cfg.Icon size={rank === 1 ? 44 : 32} className={rank === 1 ? "text-amber-300" : rank === 2 ? "text-slate-300" : "text-amber-500"} />
          </div>
        </div>

        <div className="relative mt-3 text-2xl font-bold text-white">{team.teamName}</div>
        {team.track && (
          <div className="relative mt-1 text-sm text-slate-300">{team.track}</div>
        )}

        <div className={`relative mt-6 ${cfg.numberCls} font-black tabular-nums`} style={{
          background:
            rank === 1
              ? "linear-gradient(135deg, #fde047, #f59e0b)"
              : "linear-gradient(135deg, #e5e7eb, #94a3b8)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          {team.totalScore.toFixed(1)}
        </div>
        <div className="relative text-xs text-slate-400">of {maxPossible} max · {pct}%</div>

        <div className="relative mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background:
                rank === 1
                  ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                  : rank === 2
                    ? "linear-gradient(90deg, #cbd5e1, #94a3b8)"
                    : "linear-gradient(90deg, #d97706, #92400e)",
            }}
          />
        </div>

        <div className="relative mt-4">
          <MemberAvatars members={team.members} />
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ status }: { status: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-12 text-center">
      <Radio size={40} className="mx-auto mb-4 text-slate-500" />
      <div className="text-lg font-semibold text-white">
        {status === "draft"
          ? "Leaderboard opens when the contest goes live"
          : status === "active"
            ? "No scores yet — check back soon"
            : "No results recorded for this contest"}
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Teams will appear here once they're approved and scored.
      </p>
    </div>
  );
}
