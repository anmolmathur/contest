"use client";

/**
 * Team mentor panel.
 *
 * Drop this into any page that already knows a contest slug + a team id.
 * It lists current mentors and lets a team leader / contest admin add new
 * ones by email (or remove them). Auth is enforced server-side by
 * `/api/c/[slug]/teams/[id]/mentor`.
 *
 * Props:
 *   slug:        contest slug
 *   teamId:      the team we're managing mentors for
 *   canManage:   whether the UI should show the add/remove controls
 *                (read-only mode for non-admins/non-leaders)
 */

import { useEffect, useState, useCallback } from "react";
import { UserPlus, Mail, Briefcase, Trash2, Loader2 } from "lucide-react";

type Mentor = {
  userId: string;
  name: string | null;
  email: string;
  department: string | null;
  participantRole: string | null;
};

export function TeamMentorPanel({
  slug, teamId, canManage,
}: {
  slug: string;
  teamId: string;
  canManage: boolean;
}) {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/c/${slug}/teams/${teamId}/mentor`);
      if (res.ok) {
        const data = (await res.json()) as { mentors: Mentor[] };
        setMentors(data.mentors);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, teamId]);

  useEffect(() => { load(); }, [load]);

  async function addMentor() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/c/${slug}/teams/${teamId}/mentor`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), title: title.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add mentor");
      } else {
        setEmail("");
        setTitle("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeMentor(userId: string) {
    if (!confirm("Remove this mentor from the team?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/c/${slug}/teams/${teamId}/mentor`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to remove mentor");
      } else {
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Briefcase size={14} className="text-purple-400" /> Team Mentor(s)
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Mentors advise the team but don&apos;t submit or get scored. They do not count against team size.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      ) : mentors.length === 0 ? (
        <div className="text-xs text-slate-500 italic">No mentor assigned.</div>
      ) : (
        <ul className="space-y-2">
          {mentors.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{m.name ?? "(unnamed)"}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <Mail size={10} /> {m.email}
                  {m.department && <span className="text-slate-500">· {m.department}</span>}
                </div>
                {m.participantRole && m.participantRole !== "Mentor" && (
                  <div className="text-[10px] uppercase tracking-wider text-purple-300 mt-1">
                    {m.participantRole}
                  </div>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => removeMentor(m.userId)}
                  disabled={busy}
                  className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-500/10 disabled:opacity-50"
                  title="Remove mentor"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-3 space-y-2 border-t border-purple-500/10 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mentor@example.com"
              className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
            />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Product Mentor)  — optional"
              className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
          <button
            onClick={addMentor}
            disabled={!email.trim() || busy}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Add mentor
          </button>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <div className="text-[11px] text-slate-500">
            The mentor must already have a platform account.
            If they&apos;re not registered, create the user first from the platform admin.
          </div>
        </div>
      )}
    </div>
  );
}
