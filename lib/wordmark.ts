/**
 * Styled multi-segment contest wordmark, e.g. **AI** *dea* thon.
 * Stored in contests.brandingConfig.wordmark; rendered by components/Wordmark.tsx.
 * Client-safe.
 */
export type WordmarkFont = "display" | "serif" | "mono" | "sans";
export type WordmarkTone = "accent" | "base" | "muted";

export interface WordmarkSegment {
  text: string;
  font?: WordmarkFont;
  /** CSS font-weight, e.g. 300 / 400 / 700 */
  weight?: number;
  italic?: boolean;
  /** Relative size, 1 = base size of the surrounding heading. */
  scale?: number;
  tone?: WordmarkTone;
}

/** The TLE AIdeathon wordmark: bold display "AI", italic serif "dea", light mono "thon". */
export const AIDEATHON_WORDMARK: WordmarkSegment[] = [
  { text: "AI", font: "display", weight: 700, scale: 1.25, tone: "accent" },
  { text: "dea", font: "serif", weight: 400, italic: true, scale: 1, tone: "base" },
  { text: "thon", font: "mono", weight: 300, scale: 0.72, tone: "muted" },
];

const FONTS: WordmarkFont[] = ["display", "serif", "mono", "sans"];
const TONES: WordmarkTone[] = ["accent", "base", "muted"];

export function resolveWordmark(branding: unknown): WordmarkSegment[] | null {
  const raw = (branding as { wordmark?: unknown } | null | undefined)?.wordmark;
  if (!Array.isArray(raw)) return null;
  const segs = raw
    .filter((s) => s && typeof s === "object" && typeof (s as WordmarkSegment).text === "string" && (s as WordmarkSegment).text)
    .slice(0, 6)
    .map((s) => {
      const w = s as WordmarkSegment;
      return {
        text: w.text.slice(0, 40),
        font: FONTS.includes(w.font as WordmarkFont) ? w.font : "sans",
        weight: typeof w.weight === "number" ? Math.min(900, Math.max(100, w.weight)) : 400,
        italic: !!w.italic,
        scale: typeof w.scale === "number" ? Math.min(3, Math.max(0.3, w.scale)) : 1,
        tone: TONES.includes(w.tone as WordmarkTone) ? w.tone : "base",
      } satisfies WordmarkSegment;
    });
  return segs.length ? segs : null;
}

/** Plain-text form of a wordmark ("AIdeathon"). */
export function wordmarkText(segs: WordmarkSegment[] | null | undefined): string {
  return (segs ?? []).map((s) => s.text).join("");
}

export const WORDMARK_FONT_FAMILY: Record<WordmarkFont, string> = {
  display: "var(--font-wordmark-display), var(--font-geist-sans), sans-serif",
  serif: "var(--font-wordmark-serif), Georgia, serif",
  mono: "var(--font-wordmark-mono), var(--font-geist-mono), monospace",
  sans: "var(--font-geist-sans), sans-serif",
};
