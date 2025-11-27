"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, List } from "lucide-react";

interface PhaseScores {
  phase2: number;
  phase3: number;
  phase4: number;
}

interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  track: string;
  totalScore: number;
  phaseScores?: PhaseScores;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export default function Leaderboard({ entries }: LeaderboardProps) {
  const [viewMode, setViewMode] = useState<"cumulative" | "breakdown">("cumulative");
  const sortedEntries = [...entries].sort((a, b) => b.totalScore - a.totalScore);

  const getRankColor = (index: number) => {
    if (index === 0) return "text-yellow-500";
    if (index === 1) return "text-gray-400";
    if (index === 2) return "text-orange-700";
    return "text-gray-500";
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
          Live Leaderboard
        </h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setViewMode("cumulative")}
            variant="outline"
            size="sm"
            className={`border-white/20 ${
              viewMode === "cumulative"
                ? "bg-neon-purple/20 text-neon-purple border-neon-purple/30"
                : "text-gray-400 bg-white/5 hover:bg-white/10"
            }`}
          >
            <List className="mr-2" size={16} />
            Cumulative
          </Button>
          <Button
            onClick={() => setViewMode("breakdown")}
            variant="outline"
            size="sm"
            className={`border-white/20 ${
              viewMode === "breakdown"
                ? "bg-electric-blue/20 text-electric-blue border-electric-blue/30"
                : "text-gray-400 bg-white/5 hover:bg-white/10"
            }`}
          >
            <BarChart3 className="mr-2" size={16} />
            Phase Breakdown
          </Button>
        </div>
      </div>

      {/* Phase Legend for Breakdown View */}
      {viewMode === "breakdown" && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-400">Max Points:</span>
          <span className="text-neon-purple">P2: 25 pts</span>
          <span className="text-electric-blue">P3: 25 pts</span>
          <span className="text-hot-pink">P4: 50 pts</span>
          <span className="text-white font-semibold">Total: 100 pts</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead className="text-gray-400">Rank</TableHead>
              <TableHead className="text-gray-400">Team Name</TableHead>
              <TableHead className="text-gray-400">Track</TableHead>
              {viewMode === "breakdown" && (
                <>
                  <TableHead className="text-gray-400 text-center">P2 (25)</TableHead>
                  <TableHead className="text-gray-400 text-center">P3 (25)</TableHead>
                  <TableHead className="text-gray-400 text-center">P4 (50)</TableHead>
                </>
              )}
              <TableHead className="text-gray-400 text-right">Total (100)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {sortedEntries.map((entry, index) => (
                <motion.tr
                  key={entry.teamId}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="border-white/10"
                >
                  <TableCell className={`font-bold ${getRankColor(index)}`}>
                    <span className="text-2xl">{getRankIcon(index)}</span>
                  </TableCell>
                  <TableCell className="font-semibold text-white">
                    {entry.teamName}
                  </TableCell>
                  <TableCell className="text-gray-400">{entry.track}</TableCell>
                  {viewMode === "breakdown" && entry.phaseScores && (
                    <>
                      <TableCell className="text-center">
                        <span className="text-neon-purple font-semibold">
                          {entry.phaseScores.phase2.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-electric-blue font-semibold">
                          {entry.phaseScores.phase3.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-hot-pink font-semibold">
                          {entry.phaseScores.phase4.toFixed(1)}
                        </span>
                      </TableCell>
                    </>
                  )}
                  {viewMode === "breakdown" && !entry.phaseScores && (
                    <>
                      <TableCell className="text-center text-gray-500">-</TableCell>
                      <TableCell className="text-center text-gray-500">-</TableCell>
                      <TableCell className="text-center text-gray-500">-</TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    <span className="text-2xl font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
                      {entry.totalScore.toFixed(2)}
                    </span>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  );
}

