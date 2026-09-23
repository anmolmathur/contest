"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, ChevronDown, Clock, Gavel, MapPin, Mic2 } from "lucide-react";
import BackgroundPattern from "@/components/BackgroundPattern";
import { useContest, useContestConfig } from "@/lib/contest-context";
import type { Speaker, SpeakerRole } from "@/lib/contest-config";
import {
  KindBadge,
  SpeakerAvatar,
  formatDay,
  sortAgenda,
  speakerLine,
  timeRange,
} from "@/components/public/agenda-utils";

const ROLE_LABELS: Record<SpeakerRole, string> = {
  speaker: "Speaker",
  panelist: "Panelist",
  jury: "Jury",
  mentor: "Mentor",
  host: "Host",
};

function SpeakerCard({ speaker, juryLabel }: { speaker: Speaker; juryLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      id={`speaker-${speaker.id}`}
      className="scroll-mt-24 rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition hover:border-white/20"
    >
      <div className="flex items-start gap-4">
        <SpeakerAvatar speaker={speaker} size={64} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-white">{speaker.name}</h3>
          {speakerLine(speaker) && <p className="text-sm text-gray-400">{speakerLine(speaker)}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {(speaker.roles ?? []).map((r) => (
              <span
                key={r}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-300"
              >
                {r === "jury" ? juryLabel : ROLE_LABELS[r] ?? r}
              </span>
            ))}
          </div>
        </div>
      </div>
      {speaker.bio && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs font-semibold text-electric-blue hover:text-white"
          >
            {open ? "Hide bio" : "Read bio"}
            <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">{speaker.bio}</p>}
        </div>
      )}
    </div>
  );
}

export default function AgendaPage() {
  const { contest } = useContest();
  const { t, settings } = useContestConfig();
  const juryTerm = t("judge");

  const speakers = useMemo(() => contest.speakers ?? [], [contest.speakers]);
  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const days = useMemo(() => {
    const byDay = new Map<string, ReturnType<typeof sortAgenda>>();
    for (const item of sortAgenda(contest.agenda ?? [])) {
      const list = byDay.get(item.day) ?? [];
      list.push(item);
      byDay.set(item.day, list);
    }
    return Array.from(byDay.entries());
  }, [contest.agenda]);

  const jury = speakers.filter((s) => s.roles?.includes("jury"));
  const others = speakers.filter((s) => (s.roles ?? []).some((r) => r !== "jury") || (s.roles ?? []).length === 0);
  const empty = days.length === 0 && speakers.length === 0;

  return (
    <main className="min-h-screen overflow-x-hidden">
      <BackgroundPattern />

      <section className="px-4 pb-10 pt-16 text-center sm:pt-24 md:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-4xl font-black text-transparent sm:text-6xl md:text-7xl">
            Agenda &amp; Speakers
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-300">{contest.name}</p>
          {settings.theme && <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-400">{settings.theme}</p>}
        </motion.div>
      </section>

      {empty && (
        <section className="px-4 pb-24">
          <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <CalendarDays size={40} className="mx-auto mb-4 text-gray-500" />
            <h2 className="text-lg font-semibold text-white">The agenda will be announced soon</h2>
            <p className="mt-2 text-sm text-gray-400">
              Check back for keynotes, panel discussions, expert sessions and the speaker line-up.
            </p>
            <Link href={`/c/${contest.slug}`} className="mt-6 inline-block text-sm font-semibold text-electric-blue">
              Back to {contest.name}
            </Link>
          </div>
        </section>
      )}

      {/* Day-wise timeline */}
      {days.length > 0 && (
        <section className="px-4 pb-16 md:px-8">
          <div className="mx-auto max-w-4xl space-y-12">
            {days.map(([day, items], dayIdx) => (
              <div key={day}>
                <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-white/10 bg-[#0a0a0a]/85 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border md:px-5">
                  <div className="text-xs font-semibold uppercase tracking-widest text-hot-pink">
                    {days.length > 1 ? `Day ${dayIdx + 1}` : "Schedule"}
                  </div>
                  <div className="text-xl font-bold text-white">
                    {formatDay(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
                <ol className="relative space-y-4 border-l-2 border-white/10 pl-5 sm:pl-8">
                  {items.map((item, i) => {
                    const people = (item.speakerIds ?? [])
                      .map((id) => speakerById.get(id))
                      .filter((s): s is Speaker => !!s);
                    const muted = item.kind === "break";
                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.04 }}
                        className="relative"
                      >
                        <span
                          aria-hidden
                          className={`absolute top-5 -left-[27px] h-3 w-3 rounded-full border-2 border-[#0a0a0a] sm:-left-[39px] ${
                            muted ? "bg-gray-600" : "bg-gradient-to-r from-neon-purple to-electric-blue"
                          }`}
                        />
                        <div
                          className={`rounded-xl border p-4 sm:p-5 ${
                            muted ? "border-white/5 bg-white/[0.02]" : "border-white/10 bg-white/5 backdrop-blur-md"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            <span className="inline-flex items-center gap-1 font-semibold text-gray-200">
                              <Clock size={12} /> {timeRange(item)}
                            </span>
                            <KindBadge kind={item.kind} />
                            {item.venue && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={12} /> {item.venue}
                              </span>
                            )}
                          </div>
                          <h3 className={`mt-2 font-bold ${muted ? "text-base text-gray-400" : "text-lg text-white"}`}>
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="mt-1 whitespace-pre-line text-sm text-gray-400">{item.description}</p>
                          )}
                          {people.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {people.map((p) => (
                                <a
                                  key={p.id}
                                  href={`#speaker-${p.id}`}
                                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 py-0.5 pl-0.5 pr-3 text-xs text-gray-200 hover:border-white/30"
                                >
                                  <SpeakerAvatar speaker={p} size={24} />
                                  <span className="truncate">
                                    {p.name}
                                    {p.org ? <span className="text-gray-500"> · {p.org}</span> : null}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Jury */}
      {jury.length > 0 && (
        <section id="jury" className="scroll-mt-16 px-4 pb-16 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center gap-3">
              <Gavel className="shrink-0 text-hot-pink" size={28} />
              <div>
                <h2 className="bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-3xl font-bold text-transparent md:text-5xl">
                  Meet the {juryTerm}
                </h2>
                <p className="mt-1 text-gray-400">Industry leaders evaluating the pitches</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jury.map((s) => (
                <SpeakerCard key={`jury-${s.id}`} speaker={s} juryLabel={juryTerm} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Speakers */}
      {others.length > 0 && (
        <section id="speakers" className="scroll-mt-16 px-4 pb-24 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center gap-3">
              <Mic2 className="shrink-0 text-electric-blue" size={28} />
              <h2 className="bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-3xl font-bold text-transparent md:text-5xl">
                Speakers
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((s) =>
                // A jury member who also speaks is anchored in the jury section.
                s.roles?.includes("jury") ? (
                  <SpeakerCardNoAnchor key={s.id} speaker={s} juryLabel={juryTerm} />
                ) : (
                  <SpeakerCard key={s.id} speaker={s} juryLabel={juryTerm} />
                ),
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function SpeakerCardNoAnchor(props: { speaker: Speaker; juryLabel: string }) {
  return (
    <div>
      <SpeakerCard {...props} speaker={{ ...props.speaker, id: `${props.speaker.id}-alt` }} />
    </div>
  );
}
