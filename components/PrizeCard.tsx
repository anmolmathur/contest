"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import GlassCard from "./GlassCard";

interface PrizeCardProps {
  rank: string;
  amount?: number | null;
  color: "gold" | "silver" | "bronze" | "copper" | "steel";
  description?: string;
}

export default function PrizeCard({
  rank,
  amount,
  color,
  description,
}: PrizeCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  const hasAmount = amount != null && amount > 0;

  useEffect(() => {
    if (isInView && hasAmount) {
      let startTime: number;
      const duration = 2000; // 2 seconds

      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);

        setCount(Math.floor(progress * amount));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [isInView, amount, hasAmount]);

  const rankIcons = {
    gold: "🥇",
    silver: "🥈",
    bronze: "🥉",
    copper: "🎖️",
    steel: "🏅",
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
    >
      <GlassCard glowColor={color} className="p-8 text-center">
        <div className="text-5xl mb-4">{rankIcons[color]}</div>
        <h3 className="text-2xl font-bold text-white mb-4">{rank}</h3>
        {hasAmount && (
          <div className="text-3xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent mb-2">
            ₹{count.toLocaleString("en-IN")}
          </div>
        )}
        {description && <p className="text-gray-400 mt-4">{description}</p>}
      </GlassCard>
    </motion.div>
  );
}

