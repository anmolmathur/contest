"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackgroundPattern from "@/components/BackgroundPattern";
import GlowButton from "@/components/GlowButton";

interface ContestSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  bannerImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-green-500/20", text: "text-green-400", label: "Active" },
  draft: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Draft" },
  completed: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Completed" },
  archived: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Archived" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContests() {
      try {
        const res = await fetch("/api/contests");
        if (!res.ok) throw new Error("Failed to fetch contests");
        const data: ContestSummary[] = await res.json();
        setContests(data);

        // If there is exactly 1 active contest, redirect to it
        const activeContests = data.filter((c) => c.status === "active");
        if (activeContests.length === 1) {
          router.replace(`/c/${activeContests[0].slug}`);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    fetchContests();
  }, [router]);

  const isPlatformAdmin = session?.user?.globalRole === "platform_admin";

  return (
    <main className="min-h-screen">
      <BackgroundPattern />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-8xl font-black mb-6"
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
            HUB
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto"
          >
            Explore hackathons, challenges, and innovation contests
          </motion.p>

          {isPlatformAdmin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <Link href="/admin/contests/new">
                <GlowButton>Create Contest</GlowButton>
              </Link>
            </motion.div>
          )}
        </div>
      </section>

      {/* Contest Listing */}
      <section className="py-12 px-4 md:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-4xl md:text-5xl font-bold text-center mb-12 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent"
          >
            All Contests
          </motion.h2>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-white/20 border-t-electric-blue rounded-full"
              />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-20">
              <p className="text-red-400 text-lg">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && contests.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">
                No contests available yet. Check back soon!
              </p>
            </div>
          )}

          {/* Contest Grid */}
          {!loading && !error && contests.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {contests.map((contest, index) => {
                const status = statusColors[contest.status] ?? statusColors.draft;
                return (
                  <motion.div
                    key={contest.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 group h-full flex flex-col">
                      {/* Card Header Gradient */}
                      <div className="h-2 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink" />

                      <div className="p-6 flex flex-col flex-1">
                        {/* Status Badge */}
                        <div className="flex items-center justify-between mb-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        {/* Contest Name */}
                        <h3 className="text-2xl font-bold text-white mb-2 group-hover:bg-gradient-to-r group-hover:from-neon-purple group-hover:to-electric-blue group-hover:bg-clip-text group-hover:text-transparent transition-all">
                          {contest.name}
                        </h3>

                        {/* Description */}
                        {contest.description && (
                          <p className="text-gray-400 mb-4 line-clamp-3 flex-1">
                            {contest.description}
                          </p>
                        )}
                        {!contest.description && <div className="flex-1" />}

                        {/* Dates */}
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span>
                            {formatDate(contest.startDate)} &mdash;{" "}
                            {formatDate(contest.endDate)}
                          </span>
                        </div>

                        {/* View Contest Button */}
                        <Link href={`/c/${contest.slug}`} className="block">
                          <button className="w-full px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-neon-purple/20 to-electric-blue/20 hover:from-neon-purple/40 hover:to-electric-blue/40 border border-white/10 hover:border-white/20 transition-all duration-300">
                            View Contest
                          </button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} Innovation Hub. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
