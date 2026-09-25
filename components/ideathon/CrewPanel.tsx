"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, Flag, ShieldCheck, Target, UserCog, XCircle } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { useContest, useContestConfig } from "@/lib/contest-context";
import type { CompositionCheck } from "@/lib/team-composition";

interface CompositionPayload {
  teamId: string;
  status: string;
  solutionPaths: string[];
  problem: { id: string; title: string; description: string | null } | null;
  members: Array<{ userId: string; name: string | null; department: string | null; roles: string[] }>;
  mentors: Array<{ userId: string; name: string | null }>;
  checks: CompositionCheck[];
  decisions: Array<{ phase: number; decision: string; conditions: string | null }>;
}

const DECISION_STYLE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  go: { label: "Go", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", Icon: CheckCircle2 },
  conditional: { label: "Go with changes", cls: "border-amber-500/40 bg-amber-500/10 text-amber-100", Icon: Flag },
  out: { label: "Out", cls: "border-red-500/40 bg-red-500/10 text-red-200", Icon: XCircle },
};

/**
 * Ideathon crew panel on the dashboard: my roles (one person, many hats) and
 * department, the crew-composition checklist the submission API enforces,
 * the claimed problem, and jury gate decisions with their conditions.
 */
export function CrewPanel({
  teamId,
  myUserId,
  canEdit,
  onChanged,
}: {
  teamId: string;
  myUserId: string;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const { contest } = useContest();
  const { t, settings } = useContestConfig();
  const slug = contest.slug;
  const [data, setData] = useState<CompositionPayload | null>(null);
  const [editing, setEditing] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/c/${slug}/teams/${teamId}/composition`, { cache: "no-store" });
    if (res.ok) setData((await res.json()) as CompositionPayload);
  }, [slug, teamId]);
  useEffect(() => {
    void load();
  }, [load]);

  const me = data?.members.find((m) => m.userId === myUserId);
  const roleOptions = (contest.roleConfig ?? []).filter((r) => r.role?.trim());
  const phases = contest.phaseConfig ?? [];
  const teamWord = t("team");

  const startEdit = () => {
    setRoles(me?.roles ?? []);
    setDepartment(me?.department ?? "");
    setErr("");
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const [primary, ...extra] = roles;
      const res = await fetch(`/api/c/${slug}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantRole: primary ?? null, extraRoles: extra, department: department || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error ?? "Could not save");
        return;
      }
      setEditing(false);
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;
  const failing = data.checks.filter((c) => !c.ok);

  return (
    <GlassCard className="mb-8 p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold text-white">Your {teamWord}</h2>
        {data.status === "eliminated" ? (
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-0.5 text-xs font-semibold text-red-200">Out</span>
        ) : failing.length === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-200">
            <ShieldCheck size={12} /> Complete
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-100">
            <AlertTriangle size={12} /> {failing.length} thing{failing.length === 1 ? "" : "s"} missing before you can submit
          </span>
        )}
      </div>

      {/* Gate decisions */}
      {data.decisions.map((d) => {
        const st = DECISION_STYLE[d.decision] ?? DECISION_STYLE.go;
        const stage = phases.find((p) => p.phase === d.phase);
        return (
          <div key={d.phase} className={`mb-4 rounded-lg border px-4 py-3 text-sm ${st.cls}`}>
            <div className="flex items-center gap-2 font-semibold">
              <st.Icon size={16} /> {stage?.name ?? `Stage ${d.phase}`}: {st.label}
            </div>
            {d.conditions && (
              <p className="mt-1 whitespace-pre-line">
                <span className="font-semibold">Agreed changes:</span> {d.conditions}
              </p>
            )}
          </div>
        );
      })}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Checklist */}
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">{teamWord} checklist</h3>
          <ul className="space-y-1.5">
            {data.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                ) : (
                  <Circle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                )}
                <span className={c.ok ? "text-gray-200" : "text-white"}>
                  {c.label}
                  {c.detail && <span className="ml-1 text-xs text-gray-400">({c.detail})</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <Target size={14} className="text-emerald-300" /> Problem
            </div>
            {data.problem ? (
              <p className="mt-1 font-semibold text-white">{data.problem.title}</p>
            ) : (
              <p className="mt-1 text-gray-400">Not picked yet.</p>
            )}
            {settings.problemBankEnabled && (
              <Link href={`/c/${slug}/problems`} className="mt-1 inline-block text-xs text-electric-blue underline">
                {data.problem ? "Open the Problem Bank" : "Pick one from the Problem Bank"}
              </Link>
            )}
            {data.solutionPaths.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.solutionPaths.map((p) => (
                  <span key={p} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-gray-200">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Members + roles */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Who plays what</h3>
            {canEdit && !editing && (
              <button onClick={startEdit} className="inline-flex items-center gap-1 text-xs text-electric-blue hover:underline">
                <UserCog size={14} /> Edit my roles
              </button>
            )}
          </div>
          <ul className="divide-y divide-white/5">
            {data.members.map((m) => (
              <li key={m.userId} className="py-2 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-white">{m.name ?? "Member"}</span>
                  <span className="text-xs text-gray-400">{m.department || "no department set"}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.roles.length ? (
                    m.roles.map((r) => (
                      <span key={r} className="rounded-full bg-neon-purple/20 px-2 py-0.5 text-xs text-purple-200">
                        {r}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-amber-200">No role picked</span>
                  )}
                </div>
              </li>
            ))}
            {data.mentors.map((m) => (
              <li key={m.userId} className="py-2 text-sm text-gray-400">
                {m.name} · Tech Buddy
              </li>
            ))}
          </ul>

          {editing && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="mb-2 text-xs text-gray-300">
                Pick every role you play. The first one you tick is your main role.
              </p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {roleOptions.map((r) => {
                  const on = roles.includes(r.role);
                  return (
                    <label key={r.role} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm hover:bg-white/5" title={r.description}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setRoles((prev) => (on ? prev.filter((x) => x !== r.role) : [...prev, r.role]))}
                        className="mt-1"
                      />
                      <span>
                        <span className="text-white">{r.role}</span>
                        {r.description && <span className="block text-xs text-gray-400">{r.description}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {settings.departments && settings.departments.length > 0 && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs text-gray-300">My department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    <option value="" className="bg-gray-900">
                      Choose…
                    </option>
                    {settings.departments.map((d) => (
                      <option key={d} value={d} className="bg-gray-900">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
