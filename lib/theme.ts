/**
 * Colour theme (light / dark). Client-safe.
 *
 * Resolution order for a page:
 *   1. the visitor's own choice for this contest (cookie `theme_<slug>`),
 *      or for platform pages (hub, login, platform admin) `theme_platform`;
 *   2. the contest's default: settings.colorMode, else by contest type
 *      (hackathon → dark, business symposium → light);
 *   3. dark.
 *
 * The root layout renders <html data-theme=… data-theme-scope=…> on the
 * server so there's no flash; ThemeToggle flips it client-side and writes
 * the cookie. The light palette itself lives in app/globals.css.
 */
export type ColorMode = "light" | "dark";

export const PLATFORM_THEME_SCOPE = "platform";

export function isColorMode(v: unknown): v is ColorMode {
  return v === "light" || v === "dark";
}

export function themeCookieName(scope: string): string {
  return `theme_${scope.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function contestDefaultColorMode(contestType: string | null | undefined, settings: unknown): ColorMode {
  const configured = (settings as { colorMode?: unknown } | null | undefined)?.colorMode;
  if (isColorMode(configured)) return configured;
  return contestType === "business_symposium" ? "light" : "dark";
}
