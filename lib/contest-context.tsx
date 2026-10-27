"use client";

import { createContext, useContext, ReactNode } from "react";
import {
  term as termOf,
  termPlural as termPluralOf,
  resolveScale,
  resolveSettings,
  type AgendaItem,
  type ContestSettings,
  type ContestType,
  type ScoringScale,
  type Speaker,
  type SubmissionField,
  type TermKey,
  type Terminology,
} from "@/lib/contest-config";
import { resolveSubmissionFields } from "@/lib/submission-fields";
import { getPreset, type ContestAward, type LandingCopy } from "@/lib/contest-types";
import type { WordmarkSegment } from "@/lib/wordmark";
import type { OrgLogo } from "@/lib/org-logo";

export interface ContestTrack {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
}

export interface ScoringCriterion {
  name: string;
  key: string;
  weight: number;
  description: string;
  /** Stages this criterion applies to (empty/undefined = all). */
  phases?: number[];
}

export interface PhaseConfig {
  phase: number;
  name: string;
  maxPoints: number;
  startDate: string;
  endDate: string;
  description: string;
  details: string[];
  deliverables: string[];
  /** Go / Go-with-changes / Out decision after this stage. */
  gate?: boolean;
  /** Validated impact metrics needed before this stage can be submitted. */
  requires?: Array<"baseline" | "actual">;
}

export interface Prize {
  rank: number;
  label: string;
  amount: number | null;
  color: string;
}

export interface RoleConfig {
  role: string;
  maxPerTeam: number;
  minPerTeam?: number;
  description?: string;
}

export interface Contest {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaText: string | null;
  bannerImageUrl: string | null;
  rulesContent: string | null;
  eligibilityRules: string | null;
  teamStructureRules: string | null;
  deliverableRules: string | null;
  scoringCriteria: ScoringCriterion[] | null;
  phaseConfig: PhaseConfig[] | null;
  prizes: Prize[] | null;
  roleConfig: RoleConfig[] | null;
  maxTeams: number;
  maxApprovedTeams: number;
  maxTeamMembers: number;
  startDate: string | null;
  endDate: string | null;
  registrationDeadline: string | null;
  tracks: ContestTrack[];
  contestType: ContestType;
  submissionFields: SubmissionField[] | null;
  scoringScale: ScoringScale | null;
  terminology: Terminology | null;
  settings: ContestSettings | null;
  agenda: AgendaItem[] | null;
  speakers: Speaker[] | null;
  faqConfig: Array<{ question: string; answer: string }> | null;
  customDomain: string | null;
  awards: ContestAward[] | null;
  wordmark: WordmarkSegment[] | null;
  /** Host organisation / institution logo (brandingConfig.orgLogo). */
  orgLogo: OrgLogo | null;
  /** Parent company / brand logo (brandingConfig.parentLogo). */
  parentLogo: OrgLogo | null;
}

interface ContestContextType {
  contest: Contest;
}

const ContestContext = createContext<ContestContextType | null>(null);

export function ContestProvider({
  contest,
  children,
}: {
  contest: Contest;
  children: ReactNode;
}) {
  return (
    <ContestContext.Provider value={{ contest }}>
      {children}
    </ContestContext.Provider>
  );
}

export function useContest() {
  const context = useContext(ContestContext);
  if (!context) {
    throw new Error("useContest must be used within a ContestProvider");
  }
  return context;
}

/**
 * Resolved, never-null view of the generic engine config for the current
 * contest: vocabulary helpers, submission fields, scale, settings, landing copy.
 */
export function useContestConfig() {
  const { contest } = useContest();
  const preset = getPreset(contest.contestType);
  const terminology = contest.terminology ?? preset.terminology;
  return {
    contestType: contest.contestType,
    isSymposium: contest.contestType === "business_symposium",
    submissionFields: resolveSubmissionFields(contest.submissionFields),
    scale: resolveScale(contest.scoringScale),
    settings: resolveSettings(contest.settings),
    terminology,
    t: (key: TermKey) => termOf(terminology, key),
    tp: (key: TermKey) => termPluralOf(terminology, key),
    landing: preset.landing as LandingCopy,
    preset,
  };
}
