import { WORDMARK_FONT_FAMILY, type WordmarkSegment } from "@/lib/wordmark";
import { cn } from "@/lib/utils";

/**
 * Renders a styled wordmark (brandingConfig.wordmark) on a single baseline,
 * or `fallback` text when the contest has none. Size comes from the parent's
 * font-size (use text-* classes on `className`).
 */
export function Wordmark({
  segments,
  fallback,
  className,
  accentClassName = "text-electric-blue",
}: {
  segments: WordmarkSegment[] | null | undefined;
  fallback: string;
  className?: string;
  accentClassName?: string;
}) {
  if (!segments || segments.length === 0) return <span className={className}>{fallback}</span>;
  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap leading-none", className)} aria-label={segments.map((s) => s.text).join("")}>
      {segments.map((s, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "whitespace-pre",
            s.tone === "accent" && accentClassName,
            s.tone === "muted" && "opacity-70",
          )}
          style={{
            fontFamily: WORDMARK_FONT_FAMILY[s.font ?? "sans"],
            fontWeight: s.weight ?? 400,
            fontStyle: s.italic ? "italic" : "normal",
            fontSize: `${s.scale ?? 1}em`,
            letterSpacing: s.font === "mono" ? "0.02em" : s.font === "display" ? "-0.02em" : undefined,
          }}
        >
          {s.text}
        </span>
      ))}
    </span>
  );
}
