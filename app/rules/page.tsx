"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import GlowButton from "@/components/GlowButton";
import GlassCard from "@/components/GlassCard";
import BackgroundPattern from "@/components/BackgroundPattern";
import {
  Target,
  Users,
  Briefcase,
  Bot,
  FileCheck,
  Scale,
  Award,
  Home,
  CheckCircle2,
} from "lucide-react";

const tracks = [
  "Alumni Portal",
  "Admission Portal",
  "DigiVarsity 3.0",
  "Partner Portal",
  "Communications Portal",
  "Placement Portal",
  "Referral Portal",
];

const eligibleRoles = [
  "Developers (Frontend/Backend/Full-Stack)",
  "Technical Leads / Team Leads",
  "Product Managers / Product Owners",
  "Business SPOCs for the five project tracks",
  "QA/Test Engineers (optional as developers)",
];

const teamStructure = [
  { role: "Developers", count: "3" },
  { role: "Team Lead", count: "1" },
  { role: "Product SPOC", count: "1" },
  { role: "Business SPOC", count: "1" },
  { role: "IIT Intern", count: "1" },
];

const deliverables = [
  {
    title: "GitHub Repository",
    items: [
      "Source code",
      "ReadMe with setup + architecture",
      "Evidence of AI-assisted coding",
    ],
  },
  {
    title: "Live Demo (Server Deployed with Walkthrough)",
    items: [
      "Running application (even limited features acceptable)",
      "Clear demonstration of key workflows",
    ],
  },
  {
    title: "Pitch Deck (10–12 Slides)",
    items: [
      "Problem statement",
      "Business value",
      "Demo walkthrough",
      "AI usage showcase",
      "Current Deliverable + Future roadmap",
    ],
  },
  {
    title: "Business Validation",
    items: ["SPOC must sign off that the prototype meets core expectations"],
  },
];

const judges = [
  { name: "Shantanu Rooj" },
  { name: "Jaideep Kevalramani" },
  { name: "Anmol Mathur" },
];

const judgingCriteria = [
  {
    category: "AI Utilization (Vibe Coding)",
    weight: "35%",
    description:
      "Depth and intelligence of AI usage. Velocity Acceleration due to Vibe Coding. Quality of prompts and outcomes. Effective Use of Tools.",
  },
  {
    category: "Business Impact & Relevance",
    weight: "25%",
    description:
      "Alignment with pain points. Measurable improvements or potential organizational benefits.",
  },
  {
    category: "User Experience (UX)",
    weight: "15%",
    description: "Usability, visual polish, navigation clarity, accessibility.",
  },
  {
    category: "Innovation & Value-Added Features",
    weight: "10%",
    description:
      "Creativity beyond the base requirement. Smart integrations, novel workflows, micro-automations, AI enhancements.",
  },
  {
    category: "Completeness & Technical Execution",
    weight: "15%",
    description:
      "Working Application, code quality, deployment readiness, stability.",
  },
];

const aiEvidenceExamples = [
  "Screenshots of AI-assisted code generation",
  "Prompts used for architecture, DB schema, design, or API planning",
  "AI-generated documentation or diagrams",
  "Commit messages referencing AI contributions",
];

export default function RulesPage() {
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
              Everything you need to know about the AI/Vibe Coding Hackathon
            </p>
          </motion.div>
        </div>
      </section>

      {/* Purpose Section */}
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
              <Target className="text-neon-purple mt-1 flex-shrink-0" size={40} />
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Purpose
                </h2>
                <p className="text-xl text-gray-300 leading-relaxed">
                  To build functional, demo-ready prototypes for five strategic
                  digital transformation platforms using AI-accelerated
                  development techniques (&quot;Vibe Coding&quot;). The challenge is
                  designed to inspire innovation, improve turnaround speed, and
                  normalize the use of AI tools across teams.
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Eligibility Section */}
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
              <Users className="text-electric-blue mt-1 flex-shrink-0" size={40} />
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                Eligibility
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Eligible Participants
                </h3>
                <p className="text-gray-300 mb-4">
                  Participants must be full-time members of the organization in
                  any of the following roles:
                </p>
                <ul className="space-y-2">
                  {eligibleRoles.map((role, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2
                        className="text-green-400 mt-1 flex-shrink-0"
                        size={20}
                      />
                      <span className="text-gray-300">{role}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Team Structure
                </h3>
                <div className="bg-white/5 border border-white/20 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {teamStructure.map((member, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white/5 rounded-lg p-4"
                      >
                        <span className="text-white font-semibold">
                          {member.role}
                        </span>
                        <span className="text-2xl font-bold text-electric-blue">
                          {member.count}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-gray-300">
                      <span className="font-bold text-white">Team Size:</span> 6-7
                      members
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      (If more members needed, approval is required)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Mandatory Tracks Section */}
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
              <Briefcase className="text-hot-pink mt-1 flex-shrink-0" size={40} />
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Mandatory Tracks (Teams Choose One)
                </h2>
                <p className="text-red-400 font-bold text-lg">
                  Only 5 Teams Allowed
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tracks.map((track, index) => (
                <motion.div
                  key={track}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-lg p-4 hover:border-neon-purple/50 transition-all"
                >
                  <p className="text-white font-semibold text-center">{track}</p>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* AI Mandate Section */}
      <section className="py-12 px-4 md:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <GlassCard
            className="p-8 md:p-12 border-2 border-neon-purple/50"
            glowColor="purple"
          >
            <div className="flex items-start gap-4 mb-6">
              <Bot className="text-neon-purple mt-1 flex-shrink-0" size={40} />
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  The AI Mandate
                </h2>
                <p className="text-red-400 font-bold text-xl">
                  (Non-Negotiable Rule)
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-neon-purple/20 to-electric-blue/20 border border-neon-purple/30 rounded-lg p-6">
                <p className="text-white text-lg leading-relaxed">
                  All teams <span className="font-bold">must use AI tools</span>{" "}
                  during development and documentation. This includes LLMs, code
                  generators, copilots, prompt-based architecture drafting,
                  automated UI generation, auto-test generation, etc.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Required Evidence of AI Usage
                </h3>
                <ul className="space-y-3">
                  {aiEvidenceExamples.map((example, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2
                        className="text-neon-purple mt-1 flex-shrink-0"
                        size={20}
                      />
                      <span className="text-gray-300">{example}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
                <p className="text-red-300 font-bold text-lg">
                  ⚠️ Failure to demonstrate authentic AI involvement will result
                  in disqualification.
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Required Deliverables Section */}
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
              <FileCheck className="text-electric-blue mt-1 flex-shrink-0" size={40} />
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                Required Deliverables
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {deliverables.map((deliverable, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white/5 border border-white/20 rounded-lg p-6 hover:border-electric-blue/50 transition-all"
                >
                  <h3 className="text-xl font-bold text-white mb-4">
                    {index + 1}. {deliverable.title}
                  </h3>
                  <ul className="space-y-2">
                    {deliverable.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2">
                        <span className="text-electric-blue mt-1">•</span>
                        <span className="text-gray-300 text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Judges Section */}
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
              <Award className="text-yellow-500 mt-1 flex-shrink-0" size={40} />
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                Judges
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {judges.map((judge, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-6 text-center"
                >
                  <Award className="text-yellow-500 mx-auto mb-4" size={32} />
                  <p className="text-white font-bold text-xl">{judge.name}</p>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Judging Criteria Section */}
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
              <Scale className="text-hot-pink mt-1 flex-shrink-0" size={40} />
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Judging Criteria
                </h2>
                <p className="text-gray-300 text-lg">(100 Points Total)</p>
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
                  {judgingCriteria.map((criteria, index) => {
                    return (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        className="border-b border-white/10 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4 text-white font-semibold">
                          {criteria.category}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-block bg-gradient-to-r from-neon-purple to-electric-blue text-white font-bold px-4 py-2 rounded-full">
                            {criteria.weight}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-300 text-sm">
                          {criteria.description}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      </section>

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
              Now that you know the rules, it&apos;s time to register and start
              building!
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/register">
                <GlowButton>Register Your Team</GlowButton>
              </Link>
              <Link href="/">
                <button className="px-8 py-4 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2">
                  <Home size={20} />
                  Back to Home
                </button>
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>© 2024 Innovation Challenge. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

