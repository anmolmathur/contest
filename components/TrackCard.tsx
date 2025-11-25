"use client";

import { motion } from "framer-motion";
import { getImageUrl } from "@/lib/imageHelper";
import GlassCard from "./GlassCard";

interface TrackCardProps {
  title: string;
  description: string;
  imageKeyword: string;
}

export default function TrackCard({
  title,
  description,
  imageKeyword,
}: TrackCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, rotateY: 5 }}
      transition={{ duration: 0.3 }}
      style={{ perspective: 1000 }}
    >
      <GlassCard className="overflow-hidden cursor-pointer group">
        <div className="relative h-48 overflow-hidden">
          <motion.img
            src={getImageUrl(imageKeyword)}
            alt={title}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        </div>
        <div className="p-6">
          <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
            {title}
          </h3>
          <p className="text-gray-400">{description}</p>
        </div>
      </GlassCard>
    </motion.div>
  );
}

