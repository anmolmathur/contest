import { cache } from "react";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import {
  PLATFORM_THEME_SCOPE,
  contestDefaultColorMode,
  isColorMode,
  themeCookieName,
  type ColorMode,
} from "@/lib/theme";

const contestDefault = cache(async (slug: string): Promise<ColorMode> => {
  try {
    const c = await db.query.contests.findFirst({
      where: eq(contests.slug, slug),
      columns: { contestType: true, settings: true },
    });
    return c ? contestDefaultColorMode(c.contestType, c.settings) : "dark";
  } catch {
    return "dark";
  }
});

/** Theme for the current request: visitor cookie → contest default → dark. */
export async function resolveRequestTheme(): Promise<{ mode: ColorMode; scope: string }> {
  const h = await headers();
  const scope = h.get("x-theme-scope") || PLATFORM_THEME_SCOPE;
  const pref = (await cookies()).get(themeCookieName(scope))?.value;
  if (isColorMode(pref)) return { mode: pref, scope };
  if (scope === PLATFORM_THEME_SCOPE) return { mode: "dark", scope };
  return { mode: await contestDefault(scope), scope };
}
