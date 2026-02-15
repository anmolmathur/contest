import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ContestProvider } from "@/lib/contest-context";

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
    tracks: contest.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      sortOrder: t.sortOrder,
    })),
  };

  return (
    <ContestProvider contest={serializedContest}>
      {children}
    </ContestProvider>
  );
}

// Import the Contest type for casting jsonb fields
import type { Contest } from "@/lib/contest-context";
