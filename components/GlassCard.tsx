import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "purple" | "blue" | "pink" | "gold" | "silver" | "bronze" | "copper" | "steel";
}

export default function GlassCard({
  children,
  className,
  glowColor,
}: GlassCardProps) {
  const glowClasses = {
    purple: "shadow-[0_0_30px_rgba(124,58,237,0.3)] border-neon-purple/30",
    blue: "shadow-[0_0_30px_rgba(37,99,235,0.3)] border-electric-blue/30",
    pink: "shadow-[0_0_30px_rgba(219,39,119,0.3)] border-hot-pink/30",
    gold: "shadow-[0_0_40px_rgba(255,215,0,0.4)] border-yellow-500/40",
    silver: "shadow-[0_0_40px_rgba(192,192,192,0.4)] border-gray-400/40",
    bronze: "shadow-[0_0_40px_rgba(205,127,50,0.4)] border-orange-700/40",
    copper: "shadow-[0_0_40px_rgba(184,115,51,0.4)] border-orange-600/40",
    steel: "shadow-[0_0_40px_rgba(113,121,126,0.4)] border-gray-500/40",
  };

  return (
    <div
      className={cn(
        "bg-white/5 backdrop-blur-md border border-white/10 rounded-xl",
        glowColor && glowClasses[glowColor],
        className
      )}
    >
      {children}
    </div>
  );
}

