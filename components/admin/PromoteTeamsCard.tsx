"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";

interface Target {
  id: string;
  slug: string;
  name: string;
  status: string;
  tracks: { id: string; name: string }[];
}
interface RankedTeam {
  teamId: string;
  teamName: string;
  track: string | null;
  totalScore: number;
}
interface Result {
  promoted: { sourceTeamId: string; name: string; members: number }[];
  skipped: { sourceTeamId: string; name: string; reason: string }[];
}

/**
 * Copy teams (ranked by this contest's leaderboard) into another contest the
 * admin also administers — e.g. the top teams of a round into the final.
 * Backed by POST /api/c/[slug]/teams/promote.
 */
export function PromoteTeamsCard({
  slug,
  teamTerm = "Team",
  trackTerm = "Track",
  onError,
}: {
  slug: string;
  teamTerm?: string;
  trackTerm?: string;
  onError: (msg: string) => void;
}) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [teams, setTeams] = useState<RankedTeam[]>([]);
  const [targetSlug, setTargetSlug] = useState("");
  const [trackId, setTrackId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState(3);
  const [approved, setApproved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, l] = await Promise.all([
          fetch(`/api/c/${slug}/teams/promote`).then((r) => r.json()),
          fetch(`/api/c/${slug}/leaderboard`).then((r) => r.json()),
        ]);
        if (!alive) return;
        setTargets(t.targets ?? []);
        setTeams(l.leaderboard ?? []);
      } catch {
        /* card just stays empty */
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const target = useMemo(() => targets.find((t) => t.slug === targetSlug), [targets, targetSlug]);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const promote = async () => {
    if (!target || selected.size === 0) return;
    if (!confirm(`Copy ${selected.size} ${teamTerm.toLowerCase()}(s) into "${target.name}"? The originals here are not changed.`)) return;
    setBusy(true);
    setResult(null);
    try {
      const ordered = teams.map((t) => t.teamId).filter((id) => selected.has(id));
      const res = await fetch(`/api/c/${slug}/teams/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSlug, teamIds: ordered, trackId: trackId || undefined, approved }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return onError(data.error || "Promotion failed");
      setResult(data as Result);
      setSelected(new Set());
    } catch {
      onError("Promotion failed");
    } finally {
      setBusy(false);
    }
  };

  if (targets.length === 0) return null;

  return (
    <GlassCard className="space-y-4 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <ArrowRightCircle className="text-neon-purple" size={28} />
        <div>
          <h3 className="text-lg font-bold text-white">Promote {teamTerm.toLowerCase()}s to another contest</h3>
          <p className="text-sm text-gray-400">
            Copies the selected {teamTerm.toLowerCase()}s and their participants into a contest you also administer.
            This contest is left untouched.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={targetSlug}
          onChange={(e) => {
            setTargetSlug(e.target.value);
            setTrackId("");
          }}
          className="rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
        >
          <option value="">Select target contest…</option>
          {targets.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name} ({t.status})
            </option>
          ))}
        </select>
        {target && target.tracks.length > 0 && (
          <select
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            className="rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">{trackTerm}: match by name</option>
            {target.tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
        <span>Select top</span>
        <input
          type="number"
          min={1}
          value={topN}
          onChange={(e) => setTopN(Math.max(1, Number(e.target.value) || 1))}
          className="w-16 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-white"
        />
        <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set(teams.slice(0, topN).map((t) => t.teamId)))}>
          Apply
        </Button>
        <label className="ml-auto flex items-center gap-2">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
          Mark as approved in target
        </label>
      </div>

      <div className="max-h-64 divide-y divide-white/10 overflow-y-auto rounded-md border border-white/10">
        {teams.length === 0 && <p className="p-3 text-sm text-gray-500">No ranked {teamTerm.toLowerCase()}s yet.</p>}
        {teams.map((t, i) => (
          <label key={t.teamId} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/5">
            <input type="checkbox" checked={selected.has(t.teamId)} onChange={() => toggle(t.teamId)} />
            <span className="w-6 text-gray-500">#{i + 1}</span>
            <span className="flex-1">{t.teamName}</span>
            {t.track && <span className="text-xs text-gray-400">{t.track}</span>}
            <span className="tabular-nums text-gray-300">{t.totalScore.toFixed(1)}</span>
          </label>
        ))}
      </div>

      <Button type="button" onClick={promote} disabled={busy || !target || selected.size === 0}>
        {busy && <Loader2 size={16} className="mr-2 animate-spin" />}
        Promote {selected.size || ""} {teamTerm.toLowerCase()}{selected.size === 1 ? "" : "s"}
      </Button>

      {result && (
        <div className="space-y-1 text-sm">
          {result.promoted.length > 0 && (
            <p className="text-green-400">
              Promoted {result.promoted.length}: {result.promoted.map((p) => `${p.name} (${p.members})`).join(", ")}
            </p>
          )}
          {result.skipped.map((s) => (
            <p key={s.sourceTeamId} className="text-amber-400">
              Skipped {s.name || s.sourceTeamId}: {s.reason}
            </p>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
