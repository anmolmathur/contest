"use client";

import {
  Activity, BarChart3, BookOpen, Bot, BrainCircuit, Briefcase, Building2, ChartLine, Cloud, Cog, Coins, Compass, Cpu,
  CreditCard, Database, Droplets, Factory, Gauge, Globe, GraduationCap, HandHeart, Handshake, HeartHandshake, HeartPulse,
  IndianRupee, Landmark, Leaf, Lightbulb, LineChart, Lock, Megaphone, Network, Package, PieChart, PiggyBank, Pill, Radio,
  Recycle, Rocket, Route, Scale, School, ShieldCheck, ShoppingBag, Smartphone, Smile, Sparkles, Sprout, Stethoscope, Store,
  Sun, Target, Tractor, Trash2, TrendingUp, Truck, Unlock, UserCheck, Users, Wallet, Warehouse, Wheat, Wifi, Wind, Workflow,
  Wrench, Zap, type LucideIcon,
} from "lucide-react";
import { trackTheme } from "@/lib/track-art";

const ICONS: Record<string, LucideIcon> = {
  Activity, BarChart3, BookOpen, Bot, BrainCircuit, Briefcase, Building2, ChartLine, Cloud, Cog, Coins, Compass, Cpu,
  CreditCard, Database, Droplets, Factory, Gauge, Globe, GraduationCap, HandHeart, Handshake, HeartHandshake, HeartPulse,
  IndianRupee, Landmark, Leaf, Lightbulb, LineChart, Lock, Megaphone, Network, Package, PieChart, PiggyBank, Pill, Radio,
  Recycle, Rocket, Route, Scale, School, ShieldCheck, ShoppingBag, Smartphone, Smile, Sparkles, Sprout, Stethoscope, Store,
  Sun, Target, Tractor, Trash2, TrendingUp, Truck, Unlock, UserCheck, Users, Wallet, Warehouse, Wheat, Wifi, Wind, Workflow,
  Wrench, Zap,
};

const WHITE = "#ffffff";

/**
 * Illustrated cover for a track/category, matched to its theme (FinTech,
 * Health, Education, ...). Used when the track has no custom image. Colours
 * are inline so the artwork looks the same in light and dark mode.
 */
export default function TrackArt({
  name,
  description,
  className = "",
}: {
  name: string;
  description?: string | null;
  className?: string;
}) {
  const theme = trackTheme(name, description);
  const [hero, a, b, c] = theme.icons.map((n) => ICONS[n] ?? Lightbulb);
  const Hero = hero;
  const satellites: Array<{ Icon: LucideIcon; style: React.CSSProperties; size: number }> = [
    { Icon: a, style: { left: "12%", top: "18%" }, size: 22 },
    { Icon: b, style: { right: "12%", top: "22%" }, size: 22 },
    { Icon: c, style: { right: "22%", bottom: "14%" }, size: 18 },
  ];
  return (
    <div
      role="img"
      aria-label={`${name} — ${theme.label}`}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
    >
      {/* soft light + dot grid */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.28), transparent 45%), radial-gradient(circle at 85% 90%, rgba(0,0,0,0.25), transparent 50%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-25"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
      />
      {/* oversized watermark of the hero icon */}
      <Hero
        aria-hidden
        className="absolute -bottom-6 -left-6"
        style={{ color: WHITE, opacity: 0.12 }}
        size={150}
        strokeWidth={1.25}
      />
      {/* orbit rings */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 150, height: 150, border: "1px dashed rgba(255,255,255,0.35)" }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 230, height: 230, border: "1px solid rgba(255,255,255,0.15)" }}
      />
      {/* hero */}
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-110"
        style={{
          width: 84,
          height: 84,
          background: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.45)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          backdropFilter: "blur(4px)",
        }}
      >
        <Hero aria-hidden size={44} strokeWidth={1.75} style={{ color: WHITE }} />
      </div>
      {satellites.map(({ Icon, style, size }, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center rounded-full"
          style={{
            ...style,
            width: size + 20,
            height: size + 20,
            background: "rgba(255,255,255,0.16)",
            border: "1px solid rgba(255,255,255,0.35)",
          }}
        >
          <Icon aria-hidden size={size} strokeWidth={1.75} style={{ color: WHITE }} />
        </div>
      ))}
    </div>
  );
}
