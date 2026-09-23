import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ContestProvider } from "@/lib/contest-context";
import { ContestStatusBanner } from "@/components/ContestStatusBanner";
import { AssistantWidget } from "@/components/AssistantWidget";
import { ContestNav, HideOnStage } from "@/components/public/ContestChrome";
import { resolveSettings } from "@/lib/contest-config";
import type { Metadata } from "next";

// Import the Contest type for casting jsonb fields
import type { Contest } from "@/lib/contest-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const contest = await db.query.contests.findFirst({
    where: eq(contests.slug, slug),
  });
  if (!contest) return {};
  const branding = (contest.brandingConfig ?? {}) as {
    metaTitle?: string;
    metaDescription?: string;
    faviconUrl?: string;
    ogImageUrl?: string;
  };
  return {
    title: branding.metaTitle ?? contest.name,
    description: branding.metaDescription ?? contest.description ?? undefined,
    icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
    openGraph: {
      title: branding.metaTitle ?? contest.name,
      description: branding.metaDescription ?? contest.description ?? undefined,
      images: branding.ogImageUrl ? [branding.ogImageUrl] : undefined,
    },
  };
}

export default async function ContestLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const contest = await db.query.contests.findFirst({
    where: eq(contests.slug, slug),
    with: {
      tracks: {
        orderBy: (tracks, { asc }) => [asc(tracks.sortOrder)],
      },
    },
  });

  if (!contest) {
    notFound();
  }

  // Pull brand colors for per-tenant theming (Milestone 2 hook point)
  const branding = (contest.brandingConfig ?? {}) as {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  };
  const brandStyle: React.CSSProperties & Record<string, string> = {};
  if (branding.primaryColor) brandStyle["--brand-primary"] = branding.primaryColor;
  if (branding.secondaryColor) brandStyle["--brand-secondary"] = branding.secondaryColor;
  if (branding.accentColor) brandStyle["--brand-accent"] = branding.accentColor;

  // Serialize the contest data for the client context
  const serializedContest = {
    id: contest.id,
    name: contest.name,
    slug: contest.slug,
    description: contest.description,
    status: contest.status,
    heroTitle: contest.heroTitle,
    heroSubtitle: contest.heroSubtitle,
    heroCtaText: contest.heroCtaText,
    bannerImageUrl: contest.bannerImageUrl,
    rulesContent: contest.rulesContent,
    eligibilityRules: contest.eligibilityRules,
    teamStructureRules: contest.teamStructureRules,
    deliverableRules: contest.deliverableRules,
    scoringCriteria: contest.scoringCriteria as Contest["scoringCriteria"],
    phaseConfig: contest.phaseConfig as Contest["phaseConfig"],
    prizes: contest.prizes as Contest["prizes"],
    roleConfig: contest.roleConfig as Contest["roleConfig"],
    maxTeams: contest.maxTeams,
    maxApprovedTeams: contest.maxApprovedTeams,
    maxTeamMembers: contest.maxTeamMembers,
    startDate: contest.startDate?.toISOString() ?? null,
    endDate: contest.endDate?.toISOString() ?? null,
    registrationDeadline: contest.registrationDeadline?.toISOString() ?? null,
    contestType: (contest.contestType === "business_symposium" ? "business_symposium" : "hackathon") as Contest["contestType"],
    submissionFields: contest.submissionFields as Contest["submissionFields"],
    scoringScale: contest.scoringScale as Contest["scoringScale"],
    terminology: contest.terminology as Contest["terminology"],
    settings: contest.settings as Contest["settings"],
    agenda: contest.agenda as Contest["agenda"],
    speakers: contest.speakers as Contest["speakers"],
    faqConfig: contest.faqConfig as Contest["faqConfig"],
    customDomain: contest.customDomainVerifiedAt ? contest.customDomain : null,
    tracks: contest.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      sortOrder: t.sortOrder,
    })),
  };

  const settings = resolveSettings(contest.settings);
  const hasAgenda =
    (Array.isArray(contest.agenda) && contest.agenda.length > 0) ||
    (Array.isArray(contest.speakers) && contest.speakers.length > 0);

  return (
    <div style={brandStyle}>
      <HideOnStage>
        <ContestStatusBanner status={contest.status} />
      </HideOnStage>
      <ContestNav
        slug={contest.slug}
        name={contest.name}
        showAgenda={hasAgenda}
        showShowcase={!!settings.showcaseEnabled}
      />
      <ContestProvider contest={serializedContest}>
        {children}
      </ContestProvider>
      {/* AI assistant — suppressed for drafts (avoid leaking unfinished rules),
          when the contest disables it, and on the projector stage view. */}
      {settings.assistantEnabled && contest.status !== "draft" && (
        <HideOnStage>
          <AssistantWidget contestSlug={contest.slug} />
        </HideOnStage>
      )}
    </div>
  );
}
