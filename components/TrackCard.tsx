"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import GlassCard from "./GlassCard";
import TrackArt from "./TrackArt";

interface TrackCardProps {
  title: string;
  description: string;
  /** Custom cover image set by the organiser; empty = built-in themed artwork. */
  imageUrl?: string | null;
}

export default function TrackCard({ title, description, imageUrl }: TrackCardProps) {
  const [broken, setBroken] = useState(false);
  const custom = imageUrl?.trim() && !broken ? imageUrl.trim() : null;
  return (
    <motion.div
      whileHover={{ scale: 1.05, rotateY: 5 }}
      transition={{ duration: 0.3 }}
      style={{ perspective: 1000 }}
    >
      <GlassCard className="overflow-hidden cursor-pointer group">
        <div className="relative h-48 overflow-hidden">
          {custom ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={custom}
                alt={title}
                onError={() => setBroken(true)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </>
          ) : (
            <TrackArt name={title} description={description} />
          )}
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
