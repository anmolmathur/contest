export interface CertificateTemplate {
  id?: string;
  name?: string;
  isDefault?: boolean;
  titleText: string;
  subtitleText: string;
  eventName: string;
  footerText: string | null;
  signatureName: string | null;
  signatureTitle: string | null;
  primaryLogoUrl: string | null;
  secondaryLogoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  createdBy?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  creator?: {
    id: string;
    name: string | null;
  };
}

export interface WinningTeam {
  teamId: string;
  teamName: string;
  track: string;
  leaderId: string | null;
  members: TeamMember[];
  phaseScores: {
    phase2: number;
    phase3: number;
    phase4: number;
  };
  totalScore: number;
  rank: number;
  rankLabel: string;
  prizeAmount: number;
  prizeColor: "gold" | "silver" | "bronze" | "copper" | "steel";
}

export interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  isLeader: boolean;
}

export interface CertificatePDFProps {
  memberName: string;
  teamName: string;
  track: string;
  rank: number;
  rankLabel: string;
  template: CertificateTemplate;
}
