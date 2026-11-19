/**
 * Built-in cover artwork for tracks/categories that have no custom image.
 *
 * The track name (then description) is matched against themes in priority
 * order, so "Entrepreneurship & Generative AI Ventures" is entrepreneurship
 * and "Health & Wellness AI" is health, while a plain "Generative AI" falls
 * through to the AI theme. Rendered by components/TrackArt.tsx.
 *
 * Replaces the old picsum.photos images, which were random photos seeded by
 * the first word of the track name and had nothing to do with the theme.
 */

export type TrackThemeKey =
  | "fintech"
  | "health"
  | "education"
  | "agriculture"
  | "waste"
  | "sustainability"
  | "retail"
  | "logistics"
  | "hr"
  | "entrepreneurship"
  | "digital"
  | "data"
  | "social"
  | "iot"
  | "industry"
  | "strategy"
  | "growth"
  | "cost"
  | "process"
  | "safeguard"
  | "adoption"
  | "ai"
  | "general";

export interface TrackTheme {
  key: TrackThemeKey;
  /** Short caption shown on the artwork. */
  label: string;
  /** Gradient stops (hex) — the artwork keeps its own colours in light and dark mode. */
  from: string;
  to: string;
  /** Lucide icon names: [hero, ...satellites]. See components/TrackArt.tsx ICONS. */
  icons: [string, string, string, string];
}

// Order = priority. Keywords are matched as word prefixes, case-insensitive.
const THEMES: Array<TrackTheme & { words: string[] }> = [
  { key: "entrepreneurship", label: "Ventures", from: "#7c3aed", to: "#f97316", icons: ["Rocket", "Lightbulb", "TrendingUp", "Sparkles"], words: ["entrepreneur", "startup", "start-up", "venture", "pitch", "founder", "incubat"] },
  { key: "fintech", label: "FinTech", from: "#047857", to: "#0ea5e9", icons: ["Landmark", "CreditCard", "IndianRupee", "Wallet"], words: ["fintech", "finance", "financial", "payment", "bank", "credit", "money", "insur", "invest"] },
  { key: "health", label: "Health", from: "#be123c", to: "#f472b6", icons: ["HeartPulse", "Stethoscope", "Activity", "Pill"], words: ["health", "wellness", "medical", "medic", "hospital", "patient", "care", "pharma", "diagnos"] },
  { key: "education", label: "Education", from: "#1d4ed8", to: "#8b5cf6", icons: ["GraduationCap", "BookOpen", "Lightbulb", "School"], words: ["education", "edtech", "learning", "learn", "tutor", "school", "campus", "student", "teach", "skill"] },
  { key: "agriculture", label: "Agriculture", from: "#4d7c0f", to: "#eab308", icons: ["Sprout", "Tractor", "Wheat", "Droplets"], words: ["agri", "farm", "rural", "crop", "livestock", "food"] },
  { key: "waste", label: "Circular", from: "#15803d", to: "#0d9488", icons: ["Recycle", "Trash2", "Leaf", "Droplets"], words: ["waste", "recycl", "circular"] },
  { key: "sustainability", label: "Sustainability", from: "#15803d", to: "#84cc16", icons: ["Leaf", "Sun", "Wind", "Zap"], words: ["sustainab", "clean", "energy", "renewable", "esg", "green", "climate", "solar", "environment", "carbon"] },
  { key: "retail", label: "Customer", from: "#db2777", to: "#f59e0b", icons: ["ShoppingBag", "Megaphone", "Store", "Smile"], words: ["retail", "marketing", "customer", "brand", "commerce", "consumer", "experience", "sales"] },
  { key: "logistics", label: "Logistics", from: "#c2410c", to: "#facc15", icons: ["Truck", "Package", "Route", "Warehouse"], words: ["supply", "logistic", "transport", "mobility", "fleet", "shipping", "warehouse"] },
  { key: "hr", label: "People", from: "#6d28d9", to: "#ec4899", icons: ["Users", "Briefcase", "Handshake", "UserCheck"], words: ["people", "hr", "human", "talent", "work", "workforce", "organi", "employ", "hiring", "recruit"] },
  { key: "digital", label: "Digital", from: "#0369a1", to: "#7c3aed", icons: ["Workflow", "Cloud", "Building2", "Cpu"], words: ["digital", "transformation", "enterprise", "automation", "cloud", "portal"] },
  { key: "data", label: "Analytics", from: "#0f766e", to: "#6366f1", icons: ["BarChart3", "PieChart", "Database", "LineChart"], words: ["data", "analytic", "insight", "decision", "dashboard"] },
  { key: "social", label: "Impact", from: "#b45309", to: "#e11d48", icons: ["HeartHandshake", "Globe", "Users", "HandHeart"], words: ["social", "impact", "inclusion", "community", "ngo", "csr"] },
  { key: "iot", label: "IoT", from: "#0e7490", to: "#22d3ee", icons: ["Wifi", "Cpu", "Radio", "Smartphone"], words: ["iot", "internet of things", "sensor", "device", "embedded"] },
  { key: "industry", label: "Industry", from: "#475569", to: "#f59e0b", icons: ["Factory", "Cog", "Wrench", "Gauge"], words: ["industr", "manufactur", "factory", "production"] },
  { key: "ai", label: "AI", from: "#4c1d95", to: "#06b6d4", icons: ["BrainCircuit", "Bot", "Sparkles", "Cpu"], words: ["ai", "artificial", "generative", "genai", "intelligence", "bot", "ml", "machine learning", "llm", "agent"] },
  { key: "strategy", label: "Strategy", from: "#1e3a8a", to: "#0ea5e9", icons: ["Target", "Compass", "ChartLine", "Lightbulb"], words: ["strategy", "strategic", "business", "consult"] },
  { key: "growth", label: "Growth", from: "#15803d", to: "#22c55e", icons: ["TrendingUp", "IndianRupee", "Target", "Rocket"], words: ["revenue", "growth", "admission", "conversion"] },
  { key: "cost", label: "Savings", from: "#0f766e", to: "#a3e635", icons: ["PiggyBank", "Coins", "Scale", "TrendingUp"], words: ["cost", "saving", "spend", "efficien"] },
  { key: "process", label: "Process", from: "#334155", to: "#6366f1", icons: ["Cog", "Workflow", "Gauge", "Wrench"], words: ["process", "operation", "turnaround"] },
  { key: "safeguard", label: "Safeguard", from: "#7f1d1d", to: "#6366f1", icons: ["ShieldCheck", "Lock", "Scale", "Network"], words: ["safeguard", "risk", "security", "secure", "compliance", "privacy", "dpdp", "cyber"] },
  { key: "adoption", label: "Adoption", from: "#9333ea", to: "#22d3ee", icons: ["Unlock", "Sparkles", "Users", "Rocket"], words: ["adoption", "unlock"] },
];

const GENERAL: TrackTheme = { key: "general", label: "Innovation", from: "#6d28d9", to: "#2563eb", icons: ["Lightbulb", "Sparkles", "Rocket", "Target"] };

function matches(text: string, word: string): boolean {
  // Word-prefix match: "hr" matches "HR" / "HR-tech" but not "three".
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}`, "i").test(text);
}

/** Pick the artwork theme for a track from its name, falling back to its description. */
export function trackTheme(name: string, description?: string | null): TrackTheme {
  for (const text of [name, description ?? ""]) {
    if (!text.trim()) continue;
    const hit = THEMES.find((t) => t.words.some((w) => matches(text, w)));
    if (hit) {
      const { words: _words, ...theme } = hit;
      void _words;
      return theme;
    }
  }
  return GENERAL;
}
