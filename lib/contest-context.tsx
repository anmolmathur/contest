"use client";

import { createContext, useContext, ReactNode } from "react";

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
  tracks: ContestTrack[];
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
