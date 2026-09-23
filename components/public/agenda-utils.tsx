"use client";

import { AGENDA_KIND_LABELS, type AgendaItem, type AgendaKind, type Speaker } from "@/lib/contest-config";

export const KIND_STYLES: Record<AgendaKind, string> = {
  keynote: "bg-neon-purple/20 text-purple-200 border-neon-purple/40",
  panel: "bg-electric-blue/20 text-blue-200 border-electric-blue/40",
  expert_session: "bg-cyan-500/15 text-cyan-200 border-cyan-400/30",
  startup_story: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  workshop: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  pitch: "bg-hot-pink/20 text-pink-200 border-hot-pink/40",
  networking: "bg-teal-500/15 text-teal-200 border-teal-400/30",
  ceremony: "bg-yellow-500/15 text-yellow-200 border-yellow-400/30",
  break: "bg-white/5 text-gray-400 border-white/10",
  other: "bg-white/10 text-gray-200 border-white/15",
};

export function KindBadge({ kind }: { kind: AgendaKind }) {
  const k = (kind in AGENDA_KIND_LABELS ? kind : "other") as AgendaKind;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${KIND_STYLES[k]}`}
    >
      {AGENDA_KIND_LABELS[k]}
    </span>
  );
}

export function sortAgenda(items: AgendaItem[]): AgendaItem[] {
  return [...items].sort((a, b) => `${a.day} ${a.start}`.localeCompare(`${b.day} ${b.start}`));
}

/** Epoch ms of an item's start in the viewer's local time (NaN when unparsable). */
export function agendaStartMs(item: AgendaItem): number {
  return new Date(`${item.day}T${item.start || "00:00"}:00`).getTime();
}

export function formatDay(day: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-IN", opts ?? { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(hhmm?: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

export function timeRange(item: AgendaItem): string {
  return item.end ? `${formatTime(item.start)} – ${formatTime(item.end)}` : formatTime(item.start);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase();
}

export function SpeakerAvatar({ speaker, size = 48 }: { speaker: Pick<Speaker, "name" | "photoUrl">; size?: number }) {
  if (speaker.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={speaker.photoUrl}
        alt={speaker.name}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-white/15 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-neon-purple to-electric-blue font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {initialsOf(speaker.name)}
    </div>
  );
}

export function speakerLine(s: Speaker): string {
  return [s.title, s.org].filter(Boolean).join(", ");
}
