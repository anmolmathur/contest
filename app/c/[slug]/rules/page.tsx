"use client";

import { useContest } from "@/lib/contest-context";
import { motion } from "framer-motion";
import Link from "next/link";
import BackgroundPattern from "@/components/BackgroundPattern";
import GlowButton from "@/components/GlowButton";
import GlassCard from "@/components/GlassCard";
import {
  Target,
  Users,
  Briefcase,
  FileCheck,
  Scale,
  Home,
  CheckCircle2,
  Calendar,
  Trophy,
} from "lucide-react";

export default function ContestRulesPage() {
  const { contest } = useContest();

  // Parse markdown-like text into paragraphs
  const renderTextContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      return (
        <p key={i} className="text-gray-300 leading-relaxed mb-2">
          {trimmed}
        </p>
      );
    });
  };

  // Parse bullet-list style content (lines starting with - or *)
  const renderListContent = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    const bulletLines = lines.filter(
      (l) => l.trim().startsWith("-") || l.trim().startsWith("*")
    );
    const paragraphLines = lines.filter(
      (l) => !l.trim().startsWith("-") && !l.trim().startsWith("*")
    );

    return (
      <>
        {paragraphLines.length > 0 && (
          <div className="mb-4">
            {paragraphLines.map((line, i) => (
              <p key={i} className="text-gray-300 leading-relaxed mb-2">
                {line.trim()}
              </p>
            ))}
          </div>
        )}
        {bulletLines.length > 0 && (
          <ul className="space-y-2">
            {bulletLines.map((line, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2
                  className="text-green-400 mt-1 flex-shrink-0"
                  size={20}
                />
                <span className="text-gray-300">
                  {line.trim().replace(/^[-*]\s*/, "")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  const hasEligibility = !!contest.eligibilityRules;
  const hasTeamStructure = !!contest.teamStructureRules;
  const hasTracks = contest.tracks && contest.tracks.length > 0;
  const hasDeliverables = !!contest.deliverableRules;
  const hasScoringCriteria =
    contest.scoringCriteria && contest.scoringCriteria.length > 0;
  const hasPhaseConfig =
    contest.phaseConfig && contest.phaseConfig.length > 0;
  const hasRulesContent = !!contest.rulesContent;
  const hasRoleConfig =
    contest.roleConfig && contest.roleConfig.length > 0;

  // Compute total weight for scoring display
  const totalWeight = hasScoringCriteria
    ? contest.scoringCriteria!.reduce((sum, c) => sum + c.weight, 0)
    : 0;

  return (
    <main className="min-h-screen">
      <BackgroundPattern />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl font-black mb-6 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              Competition Details & Rules
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
              Everything you need to know about{" "}
              <span className="text-white font-semibold">{contest.name}</span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* General Rules / Purpose Section */}
      {hasRulesContent && (
        <section className="py-12 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <GlassCard className="p-8 md:p-12" glowColor="purple">
              <div className="flex items-start gap-4 mb-4">
                <Target
                  className="text-neon-purple mt-1 flex-shrink-0"
                  size={40}
                />
                <div>
                  <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                    Purpose & Overview
                  </h2>
                  <div>{renderTextContent(contest.rulesContent!)}</div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </section>
      )}

      {/* Eligibility & Team Structure Section */}
      {(hasEligibility || hasTeamStructure) && (
        <section className="py-12 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <GlassCard className="p-8 md:p-12" glowColor="blue">
              <div className="flex items-start gap-4 mb-6">
                <Users
                  className="text-electric-blue mt-1 flex-shrink-0"
                  size={40}
                />
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Eligibility & Team Structure
                </h2>
              </div>

              <div className="space-y-6">
                {/* Eligibility */}
                {hasEligibility && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">
                      Who Can Participate
                    </h3>
                    {renderListContent(contest.eligibilityRules!)}
                  </div>
                )}

                {/* Team Structure */}
                {hasTeamStructure && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">
                      Team Composition
                    </h3>
                    {renderListContent(contest.teamStructureRules!)}
                  </div>
                )}

                {/* Role Config */}
                {hasRoleConfig && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">
                      Role Limits Per Team
                    </h3>
                    <div className="bg-white/5 border border-white/20 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {contest.roleConfig!.map((rc, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-white/5 rounded-lg p-4"
                          >
                            <span className="text-white font-semibold">
                              {rc.role}
                            </span>
                            <span className="text-2xl font-bold text-electric-blue">
                              {rc.maxPerTeam}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-gray-300">
                          <span className="font-bold text-white">
                            Max Team Size:
                          </span>{" "}
                          {contest.maxTeamMembers} members
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </section>
      )}

      {/* Tracks Section */}
      {hasTracks && (
        <section className="py-12 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <GlassCard className="p-8 md:p-12" glowColor="pink">
              <div className="flex items-start gap-4 mb-6">
                <Briefcase
                  className="text-hot-pink mt-1 flex-shrink-0"
                  size={40}
                />
                <div>
                  <h2 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                    Available Tracks
                  </h2>
                  <p className="text-gray-400 text-lg">
                    {contest.tracks.length} track
                    {contest.tracks.length !== 1 ? "s" : ""} available
                    {contest.maxApprovedTeams > 0 && (
                      <span className="text-yellow-400 font-semibold ml-2">
                        (Max {contest.maxApprovedTeams} approved teams)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contest.tracks
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      viewport={{ once: true }}
                      className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-lg p-4 hover:border-neon-purple/50 transition-all"
                    >
                      <p className="text-white font-semibold text-center">
                        {track.icon && (
                          <span className="mr-2">{track.icon}</span>
                        )}
                        {track.name}
                      </p>
                      {track.description && (
                        <p className="text-gray-400 text-sm text-center mt-2">
                          {track.description}
                        </p>
                      )}
                    </motion.div>
                  ))}
              </div>
            </GlassCard>
          </motion.div>
        </section>
      )}

      {/* Timeline / Phases Section */}
      {hasPhaseConfig && (
        <section className="py-12 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <GlassCard className="p-8 md:p-12" glowColor="purple">
              <div className="flex items-start gap-4 mb-6">
                <Calendar
                  className="text-neon-purple mt-1 flex-shrink-0"
                  size={40}
                />
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Timeline & Phases
                </h2>
              </div>

              <div className="space-y-6">
                {contest.phaseConfig!.map((phase, index) => (
                  <motion.div
                    key={phase.phase}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-neon-purple/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="inline-block bg-gradient-to-r from-neon-purple to-electric-blue text-white font-bold px-3 py-1 rounded-full text-sm">
                            Phase {phase.phase}
                          </span>
                          {phase.maxPoints > 0 && (
                            <span className="text-yellow-400 font-semibold text-sm">
                              {phase.maxPoints} pts
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-white">
                          {phase.name}
                        </h3>
                      </div>
                      {(phase.startDate || phase.endDate) && (
                        <span className="text-gray-400 text-sm whitespace-nowrap">
                          {phase.startDate && phase.endDate
                            ? `${new Date(phase.startDate).toLocaleDateString()} - ${new Date(phase.endDate).toLocaleDateString()}`
                            : phase.startDate
                            ? `From ${new Date(phase.startDate).toLocaleDateString()}`
                            : `Until ${new Date(phase.endDate!).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>

                    {phase.description && (
                      <p className="text-gray-300 mb-4">{phase.description}</p>
                    )}

                    {phase.details && phase.details.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">
                          Details
                        </h4>
                        <ul className="space-y-1">
                          {phase.details.map((detail, di) => (
                            <li
                              key={di}
                              className="flex items-start gap-2 text-sm text-gray-300"
                            >
                              <span className="text-electric-blue mt-0.5">
                                *
                              </span>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {phase.deliverables && phase.deliverables.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">
                          Deliverables
                        </h4>
                        <ul className="space-y-1">
                          {phase.deliverables.map((del, di) => (
                            <li
                              key={di}
                              className="flex items-start gap-2 text-sm text-gray-300"
                            >
                              <CheckCircle2
                                className="text-green-400 mt-0.5 flex-shrink-0"
                                size={14}
                              />
                              {del}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </section>
      )}

      {/* Deliverables Section */}
      {hasDeliverables && (
        <section className="py-12 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <GlassCard className="p-8 md:p-12" glowColor="blue">
              <div className="flex items-start gap-4 mb-6">
                <FileCheck
                  className="text-electric-blue mt-1 flex-shrink-0"
                  size={40}
                />
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Required Deliverables
                </h2>
              </div>
              <div>{renderListContent(contest.deliverableRules!)}</div>
            </GlassCard>
          </motion.div>
        </section>
      )}

      {/* Judging Criteria Section */}
      {hasScoringCriteria && (
        <section className="py-12 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <GlassCard className="p-8 md:p-12" glowColor="pink">
              <div className="flex items-start gap-4 mb-6">
                <Scale
                  className="text-hot-pink mt-1 flex-shrink-0"
                  size={40}
                />
                <div>
                  <h2 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                    Judging Criteria
                  </h2>
                  <p className="text-gray-300 text-lg">
                    (Total Weight: {Math.round(totalWeight * 100)}%)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-4 px-4 text-white font-bold">
                        Category
                      </th>
                      <th className="text-center py-4 px-4 text-white font-bold">
                        Weight
                      </th>
                      <th className="text-left py-4 px-4 text-white font-bold">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contest.scoringCriteria!.map((criteria, index) => (
                      <motion.tr
                        key={criteria.key}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        className="border-b border-white/10 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4 text-white font-semibold">
                          {criteria.name}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-block bg-gradient-to-r from-neon-purple to-electric-blue text-white font-bold px-4 py-2 rounded-full">
                            {Math.round(criteria.weight * 100)}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-300 text-sm">
                          {criteria.description}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        </section>
      )}

      {/* Prizes Section */}
      {contest.prizes && contest.prizes.length > 0 && (
        <section className="py-12 px-4 md:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <GlassCard className="p-8 md:p-12" glowColor="gold">
              <div className="flex items-start gap-4 mb-6">
                <Trophy
                  className="text-yellow-500 mt-1 flex-shrink-0"
                  size={40}
                />
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Prizes
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {contest.prizes.map((prize, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className={`bg-gradient-to-br ${
                      prize.color === "gold"
                        ? "from-yellow-500/10 to-orange-500/10 border-yellow-500/30"
                        : prize.color === "silver"
                        ? "from-gray-400/10 to-gray-500/10 border-gray-400/30"
                        : prize.color === "bronze"
                        ? "from-orange-700/10 to-orange-800/10 border-orange-700/30"
                        : "from-white/10 to-white/5 border-white/20"
                    } border rounded-lg p-6 text-center`}
                  >
                    <Trophy
                      className={`mx-auto mb-4 ${
                        prize.color === "gold"
                          ? "text-yellow-500"
                          : prize.color === "silver"
                          ? "text-gray-400"
                          : prize.color === "bronze"
                          ? "text-orange-700"
                          : "text-white"
                      }`}
                      size={32}
                    />
                    <p className="text-white font-bold text-xl mb-1">
                      {prize.label}
                    </p>
                    {prize.amount && (
                      <p className="text-2xl font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(prize.amount)}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
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
          <GlassCard className="p-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              Ready to Compete?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Now that you know the rules, head to the dashboard to get started!
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href={`/c/${contest.slug}/dashboard`}>
                <GlowButton>Go to Dashboard</GlowButton>
              </Link>
              <Link href={`/c/${contest.slug}`}>
                <button className="px-8 py-4 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2">
                  <Home size={20} />
                  Back to Contest Home
                </button>
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-gray-400 gap-4">
          <p>&copy; {new Date().getFullYear()} {contest.name}. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <Link
              href={`/c/${contest.slug}`}
              className="hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              href={`/c/${contest.slug}/dashboard`}
              className="hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href={`/c/${contest.slug}/rules`}
              className="hover:text-white transition-colors font-semibold text-white"
            >
              Rules
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
