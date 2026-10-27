"use client";

import { useMemo, useState } from "react";
import { useContest, useContestConfig } from "@/lib/contest-context";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Link from "next/link";
import GlowButton from "@/components/GlowButton";
import TrackCard from "@/components/TrackCard";
import TimelineNode from "@/components/TimelineNode";
import PrizeCard from "@/components/PrizeCard";
import BackgroundPattern from "@/components/BackgroundPattern";
import { Wordmark } from "@/components/Wordmark";
import { ValueMeter } from "@/components/ideathon/ValueMeter";
import { AwardsGrid } from "@/components/ideathon/AwardsGrid";
import { getImageUrl } from "@/lib/imageHelper";
import { orderedLogos } from "@/lib/org-logo";
import { CalendarDays, ChevronRight, MapPin, Sparkles, Trophy } from "lucide-react";
import {
  KindBadge,
  SpeakerAvatar,
  agendaStartMs,
  formatDay,
  sortAgenda,
  speakerLine,
  timeRange,
} from "@/components/public/agenda-utils";

const SECONDARY_BTN =
  "px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all";

export default function ContestPage() {
  const { contest } = useContest();
  const { landing, settings, t, tp, contestType } = useContestConfig();
  const isIdeathon = contestType === "ideathon";
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const isPlatformAdmin = session?.user?.globalRole === "platform_admin";

  const heroTitle = contest.heroTitle || contest.name;
  const heroSubtitle = contest.heroSubtitle || contest.description || "";
  const heroCtaText = contest.heroCtaText || "Register Now";
  const theme = settings.theme?.trim();
  const showTheme = !!theme && theme !== heroSubtitle.trim();
  const slug = contest.slug;
  const isRegistrationClosed = contest.registrationDeadline
    ? new Date() > new Date(contest.registrationDeadline)
    : false;

  // Status-aware CTA for the results/leaderboard button:
  //   active    → "Live Leaderboard" with a pulsing red dot (broadcast feel)
  //   completed → "View Final Results" with a trophy (awards feel)
  //   archived  → "View Results" (historical)
  //   draft     → hidden entirely (nothing to show yet)
  const showResultsCta = contest.status !== "draft";
  const resultsCtaLabel =
    contest.status === "active"
      ? "Live Leaderboard"
      : contest.status === "completed"
        ? "View Final Results"
        : "View Results";
  const resultsCtaIcon =
    contest.status === "active" ? (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"
        style={{ boxShadow: "0 0 0 0 rgba(239,68,68,0.6)", animation: "pulseDot 1.4s ease-in-out infinite" }}
      />
    ) : (
      <Trophy size={16} />
    );

  const resultsButton = showResultsCta && (
    <Link href={`/c/${slug}/results`}>
      <button
        className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-white border transition-all flex items-center gap-2 ${
          contest.status === "active"
            ? "bg-red-500/15 border-red-500/40 hover:bg-red-500/25"
            : "bg-amber-500/15 border-amber-400/40 hover:bg-amber-500/25"
        }`}
      >
        {resultsCtaIcon} {resultsCtaLabel}
      </button>
    </Link>
  );

  // ---- Agenda teaser + jury strip ------------------------------------------
  const agenda = useMemo(() => sortAgenda(contest.agenda ?? []), [contest.agenda]);
  const speakers = useMemo(() => contest.speakers ?? [], [contest.speakers]);
  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const [now] = useState(() => Date.now());
  const agendaHighlights = useMemo(() => {
    const upcoming = agenda.filter((a) => a.kind !== "break" && !(agendaStartMs(a) < now));
    const pool = upcoming.length > 0 ? upcoming : agenda.filter((a) => a.kind !== "break");
    return pool.slice(0, 4);
  }, [agenda, now]);
  const jury = useMemo(() => speakers.filter((s) => s.roles?.includes("jury")), [speakers]);

  const phaseTerm = t("phase");

  return (
    <main className="min-h-screen overflow-x-hidden">
      <BackgroundPattern />

      {/* Hero Section */}
      <section className="relative min-h-[calc(100svh-2.5rem)] flex items-center justify-center overflow-hidden py-24">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${contest.bannerImageUrl || getImageUrl(landing.fallbackBannerKeywords)})`,
          }}
        >
          <div className="absolute inset-0 bg-black/70" />
        </div>

        <div className="relative z-10 text-center px-4 w-full max-w-6xl">
          {(contest.parentLogo || contest.orgLogo) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
            >
              {orderedLogos(contest.parentLogo, contest.orgLogo, contest.logoOrder).map(({ slot, logo: l }) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={slot}
                  src={l.url}
                  alt={l.name || (slot === "parent" ? "Parent company logo" : "Organisation logo")}
                  className="max-h-16 max-w-[14rem] object-contain drop-shadow-lg sm:max-h-20"
                />
              ))}
            </motion.div>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black mb-6 break-words leading-[1.05]"
            style={
              contest.wordmark
                ? { textShadow: "0 0 80px rgba(16, 185, 129, 0.35)" }
                : {
                    WebkitTextStroke: "2px transparent",
                    backgroundImage: "linear-gradient(90deg, #7c3aed, #2563eb, #db2777)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                    textShadow: "0 0 80px rgba(124, 58, 237, 0.5)",
                  }
            }
          >
            {contest.wordmark ? (
              <Wordmark segments={contest.wordmark} fallback={heroTitle} className="text-white" accentClassName="text-emerald-300" />
            ) : (
              heroTitle
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-6 max-w-2xl mx-auto"
          >
            {heroSubtitle}
          </motion.p>

          {showTheme && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65 }}
              className="mb-8 flex justify-center"
            >
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 backdrop-blur">
                <Sparkles size={14} className="shrink-0 text-hot-pink" />
                <span className="text-gray-400">Theme:</span>
                <span className="font-semibold">{theme}</span>
              </span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="flex gap-3 sm:gap-4 justify-center flex-wrap"
          >
            {isLoggedIn ? (
              <>
                <Link href={`/c/${slug}/dashboard`}>
                  <GlowButton>Go to Dashboard</GlowButton>
                </Link>
                {resultsButton}
                <Link href={`/c/${slug}/rules`}>
                  <button className={SECONDARY_BTN}>View Rules</button>
                </Link>
                {isPlatformAdmin && (
                  <Link href="/platform/admin">
                    <button className={SECONDARY_BTN}>Platform Admin</button>
                  </Link>
                )}
              </>
            ) : (
              <>
                {isRegistrationClosed ? (
                  <span className="px-8 py-4 rounded-xl font-bold text-red-300 bg-red-500/10 border border-red-500/20">
                    Registration Closed
                  </span>
                ) : (
                  <Link href="/register">
                    <GlowButton>{heroCtaText}</GlowButton>
                  </Link>
                )}
                {resultsButton}
                <Link href={`/c/${slug}/rules`}>
                  <button className={SECONDARY_BTN}>View Rules</button>
                </Link>
                <Link href="/login">
                  <button className={SECONDARY_BTN}>Sign In</button>
                </Link>
              </>
            )}
          </motion.div>

          {/* keyframes for the live pulse dot; colocated so the button doesn't
              depend on any new global CSS rule. */}
          <style jsx global>{`
            @keyframes pulseDot {
              0%   { box-shadow: 0 0 0 0    rgba(239,68,68,0.6); }
              70%  { box-shadow: 0 0 0 10px rgba(239,68,68,0);   }
              100% { box-shadow: 0 0 0 0    rgba(239,68,68,0);   }
            }
          `}</style>
        </div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-6 left-1/2 transform -translate-x-1/2 hidden sm:block"
        >
          <div className="text-white/50 text-sm">Scroll to explore</div>
          <div className="text-white/50 text-2xl text-center">&darr;</div>
        </motion.div>
      </section>

      {/* Tracks / Categories Section */}
      {contest.tracks && contest.tracks.length > 0 && (
        <section className="py-20 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-7xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-center mb-4 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              {landing.tracksHeading}
            </h2>
            <p className="text-center text-gray-400 mb-12 text-lg">
              {landing.tracksSubheading}
              <span className="text-gray-500">
                {" "}
                · {contest.tracks.length}{" "}
                {(contest.tracks.length === 1 ? t("track") : tp("track")).toLowerCase()}
              </span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
              {contest.tracks.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <TrackCard
                    title={track.name}
                    description={track.description || ""}
                    imageKeyword={track.name.toLowerCase().replace(/\s+/g, ",")}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* Agenda highlights */}
      {agendaHighlights.length > 0 && (
        <section className="py-16 px-4 md:px-8 relative">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Agenda Highlights
                </h2>
                <p className="mt-2 text-gray-400">Keynotes, panels, expert sessions and more</p>
              </div>
              <Link
                href={`/c/${slug}/agenda`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-electric-blue hover:text-white"
              >
                Full agenda <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agendaHighlights.map((item, i) => {
                const people = (item.speakerIds ?? [])
                  .map((id) => speakerById.get(id))
                  .filter((s): s is NonNullable<typeof s> => !!s);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    viewport={{ once: true }}
                    className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <KindBadge kind={item.kind} />
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} /> {formatDay(item.day, { day: "numeric", month: "short" })} ·{" "}
                        {timeRange(item)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-white">{item.title}</h3>
                    {item.venue && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={12} /> {item.venue}
                      </p>
                    )}
                    {people.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {people.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-0.5 pl-0.5 pr-3 text-xs text-gray-200"
                          >
                            <SpeakerAvatar speaker={p} size={22} />
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Meet the Jury */}
      {jury.length > 0 && (
        <section className="py-16 px-4 md:px-8 relative">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Meet the {t("judge")}
                </h2>
                <p className="mt-2 text-gray-400">
                  Industry leaders evaluating every {t("submission").toLowerCase()}
                </p>
              </div>
              <Link
                href={`/c/${slug}/agenda#jury`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-electric-blue hover:text-white"
              >
                All speakers <ChevronRight size={16} />
              </Link>
            </div>
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
              {jury.map((s) => (
                <Link
                  key={s.id}
                  href={`/c/${slug}/agenda#speaker-${s.id}`}
                  className="w-44 shrink-0 snap-start rounded-xl border border-white/10 bg-white/5 p-4 text-center transition hover:border-neon-purple/40 hover:bg-white/10"
                >
                  <div className="flex justify-center">
                    <SpeakerAvatar speaker={s} size={72} />
                  </div>
                  <div className="mt-3 text-sm font-bold text-white line-clamp-2">{s.name}</div>
                  <div className="mt-1 text-xs text-gray-400 line-clamp-2">{speakerLine(s)}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Timeline Section */}
      {contest.phaseConfig && contest.phaseConfig.length > 0 && (
        <section className="py-20 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-center mb-16 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              Timeline &amp; {tp("phase")}
            </h2>

            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-neon-purple via-electric-blue to-hot-pink" />

              <div className="space-y-12">
                {contest.phaseConfig.map((phase, index) => {
                  const fmtDate = (d: string) => {
                    try {
                      return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });
                    } catch {
                      return d;
                    }
                  };
                  const dateLabel =
                    phase.startDate && phase.endDate
                      ? `${fmtDate(phase.startDate)} - ${fmtDate(phase.endDate)}`
                      : phase.startDate
                        ? fmtDate(phase.startDate)
                        : phase.endDate
                          ? fmtDate(phase.endDate)
                          : `${phaseTerm} ${phase.phase}`;

                  return (
                    <TimelineNode
                      key={`phase-${phase.phase}`}
                      date={dateLabel}
                      title={`${phaseTerm} ${phase.phase} · ${phase.name}`}
                      description={phase.description}
                      index={index}
                      points={phase.maxPoints}
                      details={phase.details}
                      deliverables={phase.deliverables}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>
        </section>
      )}

      {/* Prizes / Awards Section */}
      {contest.prizes && contest.prizes.length > 0 && (
        <section className="py-20 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-center mb-4 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              {landing.prizesHeading}
            </h2>
            <p className="text-center text-gray-400 mb-12 text-lg">{landing.prizesSubheading}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {contest.prizes.map((prize) => (
                <PrizeCard
                  key={`prize-${prize.rank}`}
                  rank={prize.label}
                  amount={prize.amount}
                  color={prize.color as "gold" | "silver" | "bronze" | "copper" | "steel"}
                />
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* Ideathon: category awards + Value Unlocked meter */}
      {isIdeathon && contest.awards && contest.awards.length > 0 && (
        <section className="px-4 pb-12 md:px-8 relative">
          <div className="mx-auto max-w-6xl">
            <h3 className="mb-6 text-center text-2xl font-bold text-white md:text-3xl">Category awards</h3>
            <AwardsGrid slug={slug} initial={contest.awards} />
          </div>
        </section>
      )}
      {isIdeathon && contest.status !== "draft" && (
        <section className="px-4 py-12 md:px-8 relative">
          <div className="mx-auto max-w-6xl">
            <ValueMeter slug={slug} teamWord={t("team")} />
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-8 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              {landing.ctaHeading}
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 mb-8">{landing.ctaSubheading}</p>
            <div className="flex gap-3 sm:gap-4 justify-center flex-wrap">
              {isLoggedIn ? (
                <>
                  <Link href={`/c/${slug}/dashboard`}>
                    <GlowButton>Go to Dashboard</GlowButton>
                  </Link>
                  {resultsButton}
                  <Link href={`/c/${slug}/rules`}>
                    <button className={SECONDARY_BTN}>Competition Rules</button>
                  </Link>
                  {isPlatformAdmin && (
                    <Link href="/platform/admin">
                      <button className={SECONDARY_BTN}>Platform Admin</button>
                    </Link>
                  )}
                </>
              ) : (
                <>
                  {isRegistrationClosed ? (
                    <span className="px-8 py-4 rounded-xl font-bold text-red-300 bg-red-500/10 border border-red-500/20">
                      Registration Closed
                    </span>
                  ) : (
                    <Link href="/register">
                      <GlowButton>Get Started</GlowButton>
                    </Link>
                  )}
                  {resultsButton}
                  <Link href={`/c/${slug}/rules`}>
                    <button className={SECONDARY_BTN}>Competition Rules</button>
                  </Link>
                  <Link href="/login">
                    <button className={SECONDARY_BTN}>Sign In</button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
            <Link href={`/c/${slug}/rules`} className="hover:text-white transition-colors">
              Competition Rules
            </Link>
            {isLoggedIn ? (
              <Link href={`/c/${slug}/dashboard`} className="hover:text-white transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                {!isRegistrationClosed && (
                  <Link href="/register" className="hover:text-white transition-colors">
                    Register
                  </Link>
                )}
                <Link href="/login" className="hover:text-white transition-colors">
                  Sign In
                </Link>
              </>
            )}
          </div>
          <p>
            &copy; {new Date().getFullYear()} {contest.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
