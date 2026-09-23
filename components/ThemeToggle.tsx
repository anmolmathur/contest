"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { PLATFORM_THEME_SCOPE, themeCookieName, type ColorMode } from "@/lib/theme";

/**
 * Light/dark switch. The server already rendered <html data-theme> from the
 * contest default or the visitor's saved choice; this flips it instantly and
 * remembers the choice for this contest (cookie, 1 year).
 */
export function ThemeToggle({ floating = false, className = "" }: { floating?: boolean; className?: string }) {
  // <html data-theme> is the source of truth (server-rendered, flipped below).
  const mode = useSyncExternalStore(subscribeToTheme, readTheme, () => null);

  const toggle = () => {
    const html = document.documentElement;
    const next: ColorMode = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = next;
    html.style.colorScheme = next;
    const scope = html.dataset.themeScope || PLATFORM_THEME_SCOPE;
    document.cookie = `${themeCookieName(scope)}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const label = mode === "light" ? "Switch to dark mode" : "Switch to light mode";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={
        floating
          ? `fixed bottom-6 left-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-md transition hover:bg-white/20 ${className}`
          : `flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-gray-300 transition hover:bg-white/10 hover:text-white ${className}`
      }
    >
      {mode === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

function readTheme(): ColorMode {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
