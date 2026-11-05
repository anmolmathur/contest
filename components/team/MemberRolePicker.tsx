"use client";

/**
 * Shows a teammate's team roles and, for whoever may assign them (team
 * leader/creator or an organiser), lets them pick roles from the contest's
 * roleConfig. The first role picked is the primary one. Saves through
 * PUT /api/c/[slug]/teams/[id]/member-roles.
 */
import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RoleOption {
  role: string;
  maxPerTeam?: number;
  description?: string;
}

export function memberRoles(m: { participantRole?: string | null; extraRoles?: unknown }): string[] {
  const out = m.participantRole ? [m.participantRole] : [];
  if (Array.isArray(m.extraRoles)) {
    for (const r of m.extraRoles) if (typeof r === "string" && r && !out.includes(r)) out.push(r);
  }
  return out;
}

export default function MemberRolePicker({
  apiBase,
  teamId,
  userId,
  current,
  options,
  canEdit,
  onSaved,
}: {
  apiBase: string;
  teamId: string;
  userId: string;
  current: string[];
  options: RoleOption[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (options.length === 0) return null;

  const toggle = (role: string) =>
    setPicked((p) => (p.includes(role) ? p.filter((r) => r !== role) : [...p, role]));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/teams/${teamId}/member-roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roles: picked }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not save roles");
        return;
      }
      setEditing(false);
      onSaved();
    } catch {
      setError("Could not save roles");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {current.length === 0 ? (
          <span className="text-xs text-amber-400">No role yet</span>
        ) : (
          current.map((r, i) => (
            <span
              key={r}
              className={`rounded-full border px-2 py-0.5 text-xs ${i === 0 ? "border-neon-purple/40 bg-neon-purple/15 text-white" : "border-white/15 bg-white/5 text-gray-300"}`}
            >
              {r}
            </span>
          ))
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setPicked(current);
              setError("");
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-electric-blue hover:bg-electric-blue/10"
          >
            <Pencil size={11} />
            {current.length === 0 ? "Assign roles" : "Edit roles"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const idx = picked.indexOf(o.role);
          const on = idx >= 0;
          return (
            <button
              key={o.role}
              type="button"
              title={o.description || undefined}
              aria-label={o.role}
              aria-pressed={on}
              onClick={() => toggle(o.role)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on ? "border-neon-purple/60 bg-neon-purple/20 text-white" : "border-white/15 bg-white/5 text-gray-400 hover:text-white"
              }`}
            >
              {on && <Check size={11} />}
              {o.role}
              {idx === 0 && <span className="text-[10px] text-neon-purple">primary</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={save} className="h-7 bg-gradient-to-r from-neon-purple to-electric-blue">
          {busy ? "Saving…" : "Save roles"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setEditing(false)}
          className="h-7 text-gray-400 hover:bg-white/10 hover:text-white"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
