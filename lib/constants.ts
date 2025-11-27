// Judge Emails
export const JUDGE_EMAILS: string[] = [
  "shantanu@teamlease.com",
  "jaideep.k@teamlease.com",
  "anmol.mathur@teamlease.com",
];

// Tracks
export const TRACKS = [
  "Alumni Portal",
  "Admission Portal",
  "DigiVarsity 3.0",
  "Partner Portal",
  "Communications Portal",
  "Placement Portal",
  "Referral Portal",
] as const;

// Roles
export const ROLES = [
  "Developer",
  "Technical Lead",
  "Product Owner",
  "Business SPOC",
  "QA",
  "Intern",
] as const;

// Team Constraints
export const MAX_TEAMS = 50;
export const MAX_APPROVED_TEAMS = 5;
export const MAX_TEAM_MEMBERS = 7;

// Phase Maximum Points (total = 100)
export const PHASE_MAX_POINTS = {
  2: 25,  // Phase 2: Vibe Coding Sprint
  3: 25,  // Phase 3: Mid-Point Review
  4: 50,  // Phase 4: Grand Finale
} as const;

export const ROLE_LIMITS: Record<string, number> = {
  Developer: 3,
  "Technical Lead": 1,
  "Product Owner": 1,
  "Business SPOC": 1,
  QA: 0,
  Intern: 1,
};

// Phases
export const PHASES = [1, 2, 3, 4] as const;

// Scoring Weights
export const SCORE_WEIGHTS = {
  aiUsage: 0.35,
  businessImpact: 0.25,
  ux: 0.15,
  innovation: 0.1,
  execution: 0.15,
} as const;

// Phase Weights (for legacy compatibility - now using PHASE_MAX_POINTS)
export const PHASE_WEIGHTS = {
  1: 0,     // Phase 1: No scoring
  2: 0.25,  // Phase 2: 25 pts
  3: 0.25,  // Phase 3: 25 pts
  4: 0.50,  // Phase 4: 50 pts
} as const;

// Timeline
export const TIMELINE = [
  {
    date: "24th Nov - 28th Nov",
    title: "Phase 1: Team Formation & Nominations (Week 1)",
    description: "Challenge begins! Team formation, nominations, and kickoff workshop.",
    points: 0,
    details: [
      "Announcement emailed to all departments",
      "Nominations for Developers, Leads, Product, and SPOCs",
      "Final teams published",
      "Track selection completed",
    ],
    deliverables: [
      "Kickoff Workshop: Intro to AI/Vibe Coding",
      "Expectations & deliverables overview",
      "Judging process explained",
      "Q&A session",
    ],
  },
  {
    date: "1st Dec - 5th Dec",
    title: "Phase 2: The 'Vibe Coding' Sprint (Week 1)",
    description: "Rapid AI-assisted development sprint with checkpoint demo.",
    points: 25,
    details: [
      "Defining the Scope of the Project",
      "Architecture co-design with AI",
      "UI/UX sketching using AI tools",
      "Backend scaffolding via AI code generation",
      "Automated test and documentation generation",
      "Regular stand-ups & async check-ins",
    ],
    deliverables: [
      "Statement of Work (Scope)",
      "Technical plan",
      "Prompt strategy and Examples",
      "Sprint progress update",
      "10-minute checkpoint demo to Business SPOC + Judges",
    ],
  },
  {
    date: "8th Dec - 12th Dec",
    title: "Phase 3: Mid-Point Review (End of Week 2)",
    description: "Prototype progress review with business alignment and feedback.",
    points: 25,
    details: [
      "Prototype progress evaluation",
      "Business alignment check",
      "AI usage evidence review",
      "Roadblocks identification",
    ],
    deliverables: [
      "In Progress Prototype",
      "Sprint progress update",
      "10-minute checkpoint demo to Business SPOC + Judges",
      "Committee provides actionable feedback",
    ],
  },
  {
    date: "15th Dec - 19th Dec",
    title: "Phase 4: Grand Finale – Demo Day (End of Week 4)",
    description: "Final project completion, deployment, and comprehensive demo.",
    points: 50,
    details: [
      "AI Project Development Completion",
      "Deployment to the Infrastructure",
    ],
    deliverables: [
      "Final Presentation",
      "12 minutes Demo",
      "3 minutes Q&A",
      "2 minutes AI usage showcase",
    ],
  },
  {
    date: "After Phase 4",
    title: "Phase 5: Evaluation & Award Ceremony",
    description: "Final evaluation and recognition of top performing teams.",
    points: 0,
    details: [
      "Complete evaluation of all submissions",
      "Final scoring and ranking",
      "Award ceremony for top teams",
    ],
    deliverables: [
      "Winners will get a nomination to the FAB awards or the 'Team of the Year' award at the TLE Annual Day",
    ],
  },
] as const;

// Prizes
export const PRIZES = [
  { rank: "1st Place", amount: 50000, color: "gold" as const },
  { rank: "2nd Place", amount: 40000, color: "silver" as const },
  { rank: "3rd Place", amount: 25000, color: "bronze" as const },
  { rank: "4th Place", amount: 15000, color: "copper" as const },
  { rank: "5th Place", amount: 10000, color: "steel" as const },
] as const;

