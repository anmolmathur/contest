"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import type { WordmarkSegment } from "@/lib/wordmark";
import { orderedLogos, type LogoOrder, type OrgLogo } from "@/lib/org-logo";

/** Routes that render full-bleed with no nav / banner / assistant (projector). */
export function isChromelessPath(pathname: string | null): boolean {
  return !!pathname && /\/stage\/?$/.test(pathname);
}

/** Renders children except on chromeless routes like /c/[slug]/stage. */
export function HideOnStage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isChromelessPath(pathname)) return null;
  return <>{children}</>;
}

/**
 * The contest assistant answers questions about the contest; it has no role
 * on the live-finale operating screens (stage, jury console, control room),
 * where its floating button would also cover the jury's submit bar.
 */
export function HideOnLiveScreens({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!pathname || isChromelessPath(pathname) || /\/(jury|live)\/?$/.test(pathname)) return null;
  return <>{children}</>;
}

interface NavProps {
  slug: string;
  name: string;
  showAgenda: boolean;
  showShowcase: boolean;
  /** Ideathon extras */
  showProblems?: boolean;
  showAgents?: boolean;
  showPlaybook?: boolean;
  wordmark?: WordmarkSegment[] | null;
  orgLogo?: OrgLogo | null;
  parentLogo?: OrgLogo | null;
  logoOrder?: LogoOrder;
}

/**
 * Slim contest nav bar shown above every /c/[slug]/* page. Horizontal scroll
 * on small screens; hidden on the stage view.
 */
export function ContestNav({
  slug,
  name,
  showAgenda,
  showShowcase,
  showProblems,
  showAgents,
  showPlaybook,
  wordmark,
  orgLogo,
  parentLogo,
  logoOrder,
}: NavProps) {
  const pathname = usePathname() ?? "";
  if (isChromelessPath(pathname)) return null;

  const base = `/c/${slug}`;
  const items: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
    { href: base, label: "Home", match: (p) => p === base || p === `${base}/` || p === "/" },
    { href: `${base}/rules`, label: "Rules", match: (p) => p.endsWith("/rules") },
  ];
  if (showPlaybook) items.push({ href: `${base}/playbook`, label: "Playbook", match: (p) => p.endsWith("/playbook") });
  if (showProblems) items.push({ href: `${base}/problems`, label: "Problem Bank", match: (p) => p.endsWith("/problems") });
  if (showAgenda) items.push({ href: `${base}/agenda`, label: "Agenda", match: (p) => p.endsWith("/agenda") });
  if (showShowcase) items.push({ href: `${base}/showcase`, label: "Showcase", match: (p) => p.endsWith("/showcase") });
  if (showAgents) items.push({ href: `${base}/agents`, label: "Agent Registry", match: (p) => p.endsWith("/agents") });
  items.push({ href: `${base}/results`, label: "Results", match: (p) => p.endsWith("/results") });
  items.push({ href: `${base}/dashboard`, label: "Dashboard", match: (p) => p.endsWith("/dashboard") });

  return (
    <nav
      aria-label="Contest"
      className="relative z-40 w-full border-b border-white/10 bg-[#07070c]/90 backdrop-blur-md"
    >
      <div className="mx-auto flex h-10 max-w-7xl items-center gap-3 px-4">
        {orderedLogos(parentLogo, orgLogo, logoOrder).map(({ slot, logo: l }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={slot} src={l.url} alt={l.name || (slot === "parent" ? "Parent company logo" : "Organisation logo")} className="h-7 max-w-[7rem] shrink-0 object-contain" />
        ))}
        <Link
          href={base}
          className="hidden max-w-[14rem] shrink-0 truncate text-xs font-semibold text-white/80 hover:text-white sm:block"
          title={name}
        >
          <Wordmark segments={wordmark} fallback={name} accentClassName="text-emerald-300" />
        </Link>
        <span className="hidden h-4 w-px shrink-0 bg-white/15 sm:block" />
        <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((it) => {
            const active = it.match(pathname);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
