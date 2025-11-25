"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlowButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

export default function GlowButton({
  children,
  onClick,
  className,
  type = "button",
  disabled = false,
}: GlowButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={cn(
        "relative px-8 py-4 rounded-xl font-bold text-white",
        "bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink",
        "border-2 border-transparent",
        "shadow-[0_0_20px_rgba(124,58,237,0.5)]",
        "transition-all duration-300",
        "hover:shadow-[0_0_30px_rgba(124,58,237,0.8)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <motion.div
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 rounded-xl bg-gradient-to-r from-neon-purple/20 via-electric-blue/20 to-hot-pink/20 blur-xl"
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}

