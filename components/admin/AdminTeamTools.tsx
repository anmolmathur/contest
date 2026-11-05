"use client";

/**
 * Organiser tools for teams in the admin panel: create a team on someone's
 * behalf, rename it / change its track, and add, remove or promote members.
 * Contest admins and platform admins use these; the API checks the role.
 */
import { useCallback, useEffect, useState } from "react";
import { Crown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MemberEmailRow, { type MemberRow } from "@/components/team/MemberEmailRow";
import MemberRolePicker, { memberRoles, type RoleOption } from "@/components/team/MemberRolePicker";

export interface AdminTeamTrack {
  id: string;
  name: string;
}

export interface AdminTeamMember {
  id: string;
  name: string | null;
  email: string;
  role?: string | null;
  participantRole?: string | null;
  extraRoles?: unknown;
}

export interface AdminEditableTeam {
  id: string;
  name: string;
  trackId?: string | null;
  problemId?: string | null;
  leaderId: string | null;
  members: AdminTeamMember[];
}

interface BankProblem {
  id: string;
  title: string;
  status: string;
  maxTeams: number;
  slotsLeft: number;
  claimedBy: Array<{ id: string; name: string }>;
}

const EMPTY: MemberRow = { email: "", name: "" };
const selectClass = "h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white";

async function postJson(url: string, method: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.error || `Request failed (${res.status})`;
  } catch {
    return "Network error";
  }
}

/** "Create team" button + dialog: the organiser names the leader and teammates. */
export function AdminCreateTeamButton({
  slug,
  tracks,
  teamWord,
  trackWord,
  maxMembers,
  onCreated,
}: {
  slug: string;
  tracks: AdminTeamTrack[];
  teamWord: string;
  trackWord: string;
  maxMembers: number;
  onCreated: () => void;
}) {
  const apiBase = `/api/c/${slug}`;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trackId, setTrackId] = useState("");
  const [leader, setLeader] = useState<MemberRow>(EMPTY);
  const [rows, setRows] = useState<Array<MemberRow & { key: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setTrackId("");
    setLeader(EMPTY);
    setRows([]);
    setError("");
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError(`Please enter a ${teamWord.toLowerCase()} name`);
    if (tracks.length > 0 && !trackId) return setError(`Please choose a ${trackWord.toLowerCase()}`);
    if (!leader.email.trim()) return setError("Please enter the leader's email");
    setBusy(true);
    const err = await postJson(`${apiBase}/teams/create`, "POST", {
      name: name.trim(),
      trackId: tracks.length > 0 ? trackId : undefined,
      leader: { email: leader.email.trim(), name: leader.name.trim() },
      members: rows.filter((r) => r.email.trim()).map(({ email, name: n }) => ({ email: email.trim(), name: n.trim() })),
    });
    setBusy(false);
    if (err) return setError(err);
    setOpen(false);
    reset();
    onCreated();
  };

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="bg-gradient-to-r from-neon-purple to-electric-blue"
      >
        <Plus className="mr-2" size={16} />
        Create {teamWord}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Create {teamWord}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="admin-team-name" className="text-gray-200">{teamWord} name</Label>
              <Input
                id="admin-team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            {tracks.length > 0 && (
              <div>
                <Label htmlFor="admin-team-track" className="text-gray-200">{trackWord}</Label>
                <select id="admin-team-track" value={trackId} onChange={(e) => setTrackId(e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="" className="bg-[#0a0a0a]">Choose…</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#0a0a0a]">{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-gray-200">Leader</Label>
              <MemberEmailRow apiBase={apiBase} teamWord={teamWord} value={leader} onChange={setLeader} />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-200">Teammates (optional)</Label>
              {rows.map((row) => (
                <MemberEmailRow
                  key={row.key}
                  apiBase={apiBase}
                  teamWord={teamWord}
                  value={row}
                  onChange={(next) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...next, key: r.key } : r)))}
                  onRemove={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                />
              ))}
              {rows.length < maxMembers - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRows((rs) => [...rs, { ...EMPTY, key: Date.now() }])}
                  className="w-full bg-transparent border-white/10 text-white hover:bg-white/10 hover:text-white"
                >
                  <Plus className="mr-2" size={16} />
                  Add teammate
                </Button>
              )}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button onClick={submit} disabled={busy} className="w-full bg-gradient-to-r from-neon-purple to-electric-blue">
              {busy ? "Creating…" : `Create ${teamWord}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Inline editor shown in the admin "Team Details" dialog. */
export function AdminTeamEditor({
  slug,
  team,
  tracks,
  teamWord,
  trackWord,
  roleOptions = [],
  showProblems = false,
  onChanged,
}: {
  slug: string;
  team: AdminEditableTeam;
  tracks: AdminTeamTrack[];
  teamWord: string;
  trackWord: string;
  /** contest.roleConfig — when set, each member gets a role picker. */
  roleOptions?: RoleOption[];
  /** Ideathon: let the organiser set the crew's problem from the Problem Bank. */
  showProblems?: boolean;
  onChanged: () => void;
}) {
  const apiBase = `/api/c/${slug}`;
  const [name, setName] = useState(team.name);
  const [trackId, setTrackId] = useState(team.trackId ?? "");
  const [newMember, setNewMember] = useState<MemberRow>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const run = async (fn: () => Promise<string | null>, ok: string): Promise<boolean> => {
    setError("");
    setNotice("");
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) {
      setError(err);
      return false;
    }
    setNotice(ok);
    onChanged();
    return true;
  };

  const members = team.members.filter((m) => m.role !== "mentor");

  // ---- Problem (Ideathon) ----
  const [problems, setProblems] = useState<BankProblem[]>([]);
  const [problemId, setProblemId] = useState(team.problemId ?? "");
  const fetchProblems = useCallback(async (): Promise<BankProblem[] | null> => {
    try {
      const res = await fetch(`${apiBase}/problems`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return ((data.problems ?? []) as BankProblem[]).filter((p) => p.status === "open" || p.status === "approved");
    } catch {
      return null; // Problem Bank unavailable; the section just shows no options.
    }
  }, [apiBase]);
  const loadProblems = useCallback(async () => {
    const list = await fetchProblems();
    if (list) setProblems(list);
  }, [fetchProblems]);
  useEffect(() => {
    if (!showProblems) return;
    let cancelled = false;
    fetchProblems().then((list) => {
      if (!cancelled && list) setProblems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [showProblems, fetchProblems]);

  const assignProblem = async (pid: string | null) => {
    const send = (override: boolean) =>
      fetch(`${apiBase}/teams/${team.id}/problem`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: pid, override }),
      });
    return run(async () => {
      try {
        let res = await send(false);
        let data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.code === "PROBLEM_FULL") {
          if (!confirm(`${data.error}. Assign it to ${team.name} anyway?`)) return "Not assigned";
          res = await send(true);
          data = await res.json().catch(() => ({}));
        }
        if (!res.ok) return data.error || "Could not set the problem";
        if (pid === null) setProblemId("");
        // The problem sets the crew's value lens; keep the form in step so
        // "Save changes" doesn't put the old one back.
        if (typeof data.trackId === "string") setTrackId(data.trackId);
        await loadProblems();
        return null;
      } catch {
        return "Network error";
      }
    }, pid ? "Problem assigned" : "Problem cleared");
  };
  const currentProblem = problems.find((p) => p.id === team.problemId);
  const detailsChanged = name.trim() !== team.name || (trackId || null) !== (team.trackId ?? null);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <Label htmlFor="edit-team-name" className="text-gray-200">{teamWord} name</Label>
          <Input id="edit-team-name" value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1" />
        </div>
        {tracks.length > 0 && (
          <div>
            <Label htmlFor="edit-team-track" className="text-gray-200">{trackWord}</Label>
            <select id="edit-team-track" value={trackId} onChange={(e) => setTrackId(e.target.value)} className={`${selectClass} mt-1`}>
              {tracks.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0a0a0a]">{t.name}</option>
              ))}
            </select>
          </div>
        )}
        <Button
          disabled={busy || !detailsChanged || !name.trim()}
          onClick={() =>
            run(
              () => postJson(`${apiBase}/teams/${team.id}`, "PUT", { name: name.trim(), trackId: tracks.length > 0 ? trackId : undefined }),
              `${teamWord} updated`,
            )
          }
          className="bg-gradient-to-r from-neon-purple to-electric-blue"
        >
          Save changes
        </Button>
      </div>

      {showProblems && (
        <div className="space-y-2">
          <Label htmlFor="edit-team-problem" className="text-gray-200">Problem</Label>
          <p className="text-xs text-gray-400">
            {team.problemId
              ? `Current: ${currentProblem?.title ?? "a problem no longer open in the bank"}`
              : `No problem yet. Crews normally claim one on the Problem Bank page; set it here if they can't.`}
          </p>
          <select
            id="edit-team-problem"
            value={problemId}
            onChange={(e) => setProblemId(e.target.value)}
            className={selectClass}
          >
            <option value="" className="bg-[#0a0a0a]">Choose a problem…</option>
            {problems.map((p) => {
              const mine = p.claimedBy.some((c) => c.id === team.id);
              const note = mine ? "this crew" : p.slotsLeft > 0 ? `${p.slotsLeft} of ${p.maxTeams} slots left` : "full";
              return (
                <option key={p.id} value={p.id} className="bg-[#0a0a0a]">
                  {p.title} ({note})
                </option>
              );
            })}
          </select>
          <div className="flex gap-2">
            <Button
              disabled={busy || !problemId || problemId === (team.problemId ?? "")}
              onClick={() => assignProblem(problemId)}
              className="bg-gradient-to-r from-neon-purple to-electric-blue"
            >
              Assign problem
            </Button>
            {team.problemId && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Clear the problem for ${team.name}?`)) assignProblem(null);
                }}
                className="bg-transparent border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      <div>
        <h5 className="text-lg font-semibold text-white mb-3">Members ({members.length})</h5>
        <div className="space-y-2">
          {members.map((m) => {
            const isLeader = m.id === team.leaderId;
            return (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${isLeader ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-white/5"}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold">{m.name || "Unnamed"}</p>
                    {isLeader && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                        <Crown size={10} />
                        Leader
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  {m.role === "participant" && (
                    <MemberRolePicker
                      apiBase={apiBase}
                      teamId={team.id}
                      userId={m.id}
                      current={memberRoles(m)}
                      options={roleOptions}
                      canEdit
                      onSaved={onChanged}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isLeader && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      title="Make leader"
                      aria-label={`Make ${m.name || m.email} leader`}
                      onClick={() => run(() => postJson(`${apiBase}/teams/set-leader`, "POST", { teamId: team.id, userId: m.id }), "Leader updated")}
                      className="text-amber-400 hover:bg-amber-500/10"
                    >
                      <Crown size={16} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    title="Remove from team"
                    aria-label={`Remove ${m.name || m.email}`}
                    onClick={() => {
                      if (!confirm(`Remove ${m.name || m.email} from ${team.name}?`)) return;
                      run(() => postJson(`${apiBase}/teams/remove-member`, "POST", { teamId: team.id, userId: m.id }), "Member removed");
                    }}
                    className="text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-gray-200">Add member</Label>
        <MemberEmailRow apiBase={apiBase} teamWord={teamWord} teamId={team.id} value={newMember} onChange={setNewMember} />
        <Button
          variant="outline"
          disabled={busy || !newMember.email.trim()}
          onClick={async () => {
            const ok = await run(
              () => postJson(`${apiBase}/teams/add-member`, "POST", { teamId: team.id, email: newMember.email.trim(), name: newMember.name.trim() }),
              "Member added",
            );
            if (ok) setNewMember(EMPTY);
          }}
          className="bg-transparent border-white/10 text-white hover:bg-white/10 hover:text-white"
        >
          <Plus className="mr-2" size={16} />
          Add member
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-green-400">{notice}</p>}
    </div>
  );
}
