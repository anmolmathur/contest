"use client";

/**
 * Small shared building blocks for the contest admin editors, so every
 * section has the same dark glass look without repeating class strings.
 */
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const inputCls = "bg-white/5 border-white/10 text-white text-sm";
export const dateInputCls = `${inputCls} [color-scheme:dark]`;
export const outlineBtnCls = "border-white/20 text-white bg-white/10 hover:bg-white/20";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("p-4 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
      </div>
      {children}
    </GlassCard>
  );
}

/** A bordered row inside a list editor with move-up / move-down / delete. */
export function RowShell({
  index,
  count,
  onMove,
  onRemove,
  heading,
  children,
}: {
  index: number;
  count: number;
  onMove?: (dir: -1 | 1) => void;
  onRemove: () => void;
  heading?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {onMove && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMove(-1)}
                disabled={index === 0}
                className="h-8 w-8 p-0 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Move up"
              >
                <ArrowUp size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMove(1)}
                disabled={index === count - 1}
                className="h-8 w-8 p-0 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Move down"
              >
                <ArrowDown size={14} />
              </Button>
            </>
          )}
          <span className="truncate text-sm font-medium text-gray-400">{heading ?? `#${index + 1}`}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 shrink-0 p-0 text-red-400 hover:bg-red-500/10"
          aria-label="Remove"
        >
          <Trash2 size={14} />
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Multi-select as toggleable chips (works well on touch screens). */
export function ChipMultiSelect<T extends string | number>({
  options,
  value,
  onChange,
  emptyLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (next: T[]) => void;
  emptyLabel?: string;
}) {
  if (options.length === 0) {
    return <p className="text-xs text-gray-500">{emptyLabel ?? "Nothing to choose from yet."}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              on
                ? "border-neon-purple/50 bg-neon-purple/20 text-white"
                : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10",
            )}
            aria-pressed={on}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/[0.07]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--neon-purple)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-200">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
      </span>
    </label>
  );
}

export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** "Pitch Deck (PDF)" -> "pitchDeckPdf" */
export function slugKey(label: string): string {
  const words = label
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  return /^[0-9]/.test(key) ? `f${key}` : key;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
