"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import GlowButton from "@/components/GlowButton";
import TrackCard from "@/components/TrackCard";
import TimelineNode from "@/components/TimelineNode";
import PrizeCard from "@/components/PrizeCard";
import BackgroundPattern from "@/components/BackgroundPattern";
import { getImageUrl } from "@/lib/imageHelper";
import { TIMELINE, PRIZES } from "@/lib/constants";

const tracks = [
  {
    title: "Alumni Portal",
    description: "Connect alumni with opportunities and the institution",
    keyword: "alumni,graduation,network",
  },
  {
    title: "Admission Portal",
    description: "Streamline the admission process for prospective students",
    keyword: "admission,university,education",
  },
  {
    title: "DigiVarsity 3.0",
    description: "Next-generation digital campus experience",
    keyword: "digital,campus,innovation",
  },
  {
    title: "Partner Portal",
    description: "Enhance collaboration with institutional partners",
    keyword: "partnership,collaboration,business",
  },
  {
    title: "Communications Portal",
    description: "Transform internal and external communications",
    keyword: "communication,network,social",
  },
  {
    title: "Placement Portal",
    description: "Bridge the gap between students and career opportunities",
    keyword: "career,job,placement",
  },
  {
    title: "Referral Portal",
    description: "Empower referral networks for growth",
    keyword: "referral,network,growth",
  },
];


export default function HomePage() {
  return (
    <main className="min-h-screen">
      <BackgroundPattern />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${getImageUrl(
              "artificial-intelligence,cyberpunk,technology"
            )})`,
          }}
        >
          <div className="absolute inset-0 bg-black/70" />
        </div>

        <div className="relative z-10 text-center px-4">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-7xl md:text-9xl font-black mb-6"
            style={{
              WebkitTextStroke: "2px transparent",
              backgroundImage:
                "linear-gradient(90deg, #7c3aed, #2563eb, #db2777)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              textShadow: "0 0 80px rgba(124, 58, 237, 0.5)",
            }}
          >
            INNOVATION
            <br />
            CHALLENGE
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto"
          >
            AI/Vibe Coding Hackathon - Build the Future of Education Technology
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="flex gap-4 justify-center flex-wrap"
          >
            <Link href="/register">
              <GlowButton>Register Now</GlowButton>
            </Link>
            <Link href="/rules">
              <button className="px-8 py-4 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all">
                View Rules
              </button>
            </Link>
          </motion.div>
        </div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <div className="text-white/50 text-sm">Scroll to explore</div>
          <div className="text-white/50 text-2xl text-center">↓</div>
        </motion.div>
      </section>

      {/* Tracks Section */}
      <section className="py-20 px-4 md:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto"
        >
          <h2 className="text-5xl md:text-6xl font-bold text-center mb-4 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
            Choose Your Track
          </h2>
          <p className="text-center text-gray-400 mb-12 text-lg">
            Select one of seven innovation tracks to revolutionize
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {tracks.map((track, index) => (
              <motion.div
                key={track.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <TrackCard
                  title={track.title}
                  description={track.description}
                  imageKeyword={track.keyword}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 px-4 md:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-5xl md:text-6xl font-bold text-center mb-16 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
            Challenge Timeline
          </h2>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-neon-purple via-electric-blue to-hot-pink" />

            <div className="space-y-12">
              {TIMELINE.map((event, index) => (
                <TimelineNode
                  key={event.title}
                  date={event.date}
                  title={event.title}
                  description={event.description}
                  index={index}
                  points={event.points}
                  details={event.details}
                  deliverables={event.deliverables}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Prize Pool Section */}
      <section className="py-20 px-4 md:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <h2 className="text-5xl md:text-6xl font-bold text-center mb-4 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
            Prize Pool
          </h2>
          <p className="text-center text-gray-400 mb-12 text-lg">
            Compete for amazing prizes and recognition
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PRIZES.map((prize, index) => (
              <PrizeCard
                key={prize.rank}
                rank={prize.rank}
                amount={prize.amount}
                color={prize.color}
              />
            ))}
          </div>
          <p className="text-center text-gray-400 mt-8 text-sm">
            Winners will receive nominations to the FAB awards or the &apos;Team of the Year&apos; award at the TLE Annual Day
          </p>
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
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              Ready to Innovate?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join the challenge and showcase your AI-powered solutions
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/register">
                <GlowButton>Get Started</GlowButton>
              </Link>
              <Link href="/rules">
                <button className="px-8 py-4 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all">
                  Competition Rules
                </button>
              </Link>
              <Link href="/login">
                <button className="px-8 py-4 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/rules" className="hover:text-white transition-colors">
              Competition Rules
            </Link>
            <Link href="/register" className="hover:text-white transition-colors">
              Register
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Sign In
            </Link>
          </div>
          <p>© 2025 Innovation Challenge. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
