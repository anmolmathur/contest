"use client";

import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "./GlassCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  track: string;
  totalScore: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export default function Leaderboard({ entries }: LeaderboardProps) {
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
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
        Live Leaderboard
      </h2>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead className="text-gray-400">Rank</TableHead>
              <TableHead className="text-gray-400">Team Name</TableHead>
              <TableHead className="text-gray-400">Track</TableHead>
              <TableHead className="text-gray-400 text-right">Score</TableHead>
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

