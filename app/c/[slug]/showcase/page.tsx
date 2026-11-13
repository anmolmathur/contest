"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, Eye, FileText, Lightbulb, Search, Users } from "lucide-react";
import BackgroundPattern from "@/components/BackgroundPattern";
import { useContest, useContestConfig } from "@/lib/contest-context";
import type { ShowcaseEntry, ShowcasePayload } from "@/lib/live-types";

function isFileLink(url: string): boolean {
  return /^\/(api\/)?uploads\//.test(url) || /\.(pdf|pptx?|docx?|xlsx?)(\?|$)/i.test(url);
}

export default function ShowcasePage() {
  const { contest } = useContest();
  const { t, tp, settings } = useContestConfig();
  const [data, setData] = useState<ShowcasePayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable" | "error">("loading");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/c/${contest.slug}/showcase`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) return setStatus("unavailable");
        if (!res.ok) return setStatus("error");
        setData((await res.json()) as ShowcasePayload);
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contest.slug]);

  const teams = useMemo(() => data?.teams ?? [], [data]);
  const categories = useMemo(
    () => Array.from(new Set(teams.map((e) => e.track).filter((x): x is string => !!x))).sort(),
    [teams],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((e) => {
      if (filter !== "all" && e.track !== filter) return false;
      if (!q) return true;
      return [e.name, e.track, e.problemTitle, e.headline, ...e.members].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [teams, filter, query]);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <BackgroundPattern />

      <section className="px-4 pb-8 pt-16 text-center sm:pt-24 md:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-300">
            <Lightbulb size={14} className="text-amber-300" /> Innovation Showcase
          </div>
          <h1 className="bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-4xl font-black text-transparent sm:text-6xl md:text-7xl">
            {contest.name}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-300">
            {settings.theme ?? `Explore every ${t("team").toLowerCase()}'s ${t("submission").toLowerCase()}`}
          </p>
        </motion.div>
      </section>

      {data?.preview && (
        <div className="mx-auto mb-6 max-w-6xl px-4">
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
            <Eye size={16} className="shrink-0" /> Admin preview — the showcase is not public yet (enable it in contest
            settings).
          </div>
        </div>
      )}

      <section className="px-4 pb-24 md:px-8">
        <div className="mx-auto max-w-7xl">
          {status === "loading" && <div className="py-20 text-center text-gray-400">Loading showcase…</div>}

          {(status === "unavailable" || status === "error") && (
            <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <Lightbulb size={40} className="mx-auto mb-4 text-gray-500" />
              <h2 className="text-lg font-semibold text-white">
                {status === "unavailable" ? "The showcase isn't open yet" : "Could not load the showcase"}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                {status === "unavailable"
                  ? `${tp("team")} will be featured here once the organisers publish the showcase.`
                  : "Please try again in a moment."}
              </p>
              <Link href={`/c/${contest.slug}`} className="mt-6 inline-block text-sm font-semibold text-electric-blue">
                Back to {contest.name}
              </Link>
            </div>
          )}

          {status === "ok" && (
            <>
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
                <div className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
                  {["all", ...categories].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFilter(c)}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        filter === c
                          ? "border-neon-purple bg-neon-purple/25 text-white"
                          : "border-white/10 bg-white/5 text-gray-300 hover:border-white/30"
                      }`}
                    >
                      {c === "all" ? `All ${tp("track").toLowerCase()}` : c}
                    </button>
                  ))}
                </div>
                <div className="relative md:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${tp("team").toLowerCase()}…`}
                    className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-neon-purple/50 focus:outline-none"
                  />
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">
                  No {tp("team").toLowerCase()} to show{filter !== "all" ? ` in ${filter}` : ""}.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((e, i) => (
                    <ShowcaseCard key={e.teamId} entry={e} index={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function ShowcaseCard({ entry, index }: { entry: ShowcaseEntry; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04 }}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition hover:border-white/25"
    >
      <div className="h-1.5 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink" />
      <div className="flex flex-1 flex-col p-5">
        {entry.track && (
          <span className="mb-3 inline-flex w-fit max-w-full truncate rounded-full border border-electric-blue/30 bg-electric-blue/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200">
            {entry.track}
          </span>
        )}
        <h2 className="text-xl font-bold text-white">{entry.name}</h2>
        {entry.problemTitle && (
          <p className="mt-2 text-sm font-semibold text-gray-200">
            <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">Problem</span>
            {entry.problemTitle}
          </p>
        )}
        {entry.headline ? (
          <p className="mt-2 line-clamp-5 flex-1 text-sm leading-relaxed text-gray-300">{entry.headline}</p>
        ) : entry.problemTitle ? (
          <div className="flex-1" />
        ) : (
          <p className="mt-2 flex-1 text-sm italic text-gray-500">Details coming soon.</p>
        )}
        {entry.members.length > 0 && (
          <p className="mt-4 flex items-start gap-1.5 text-xs text-gray-400">
            <Users size={13} className="mt-0.5 shrink-0" />
            <span>{entry.members.join(", ")}</span>
          </p>
        )}
        {entry.publicLinks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.publicLinks.map((l) => (
              <a
                key={l.key}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-200 hover:border-white/40 hover:text-white"
              >
                {isFileLink(l.url) ? <FileText size={12} className="shrink-0" /> : <ExternalLink size={12} className="shrink-0" />}
                <span className="truncate">{l.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
}
