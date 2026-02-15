// ============================================================
// LEGACY CONSTANTS (kept for backward compat with existing contest)
// New contests should use per-contest config from the database
// ============================================================

// Judge Emails (legacy - new contests use contest_users table)
export const JUDGE_EMAILS: string[] = [
  "shantanu@teamlease.com",
  "jaideep.k@teamlease.com",
  "anmol.mathur@teamlease.com",
];

// Tracks (legacy - new contests use tracks table)
export const TRACKS = [
  "Alumni Portal",
  "Admission Portal",
  "DigiVarsity 3.0",
  "Partner Portal",
  "Communications Portal",
  "Placement Portal",
  "Referral Portal",
] as const;

// Roles (legacy - new contests use contest roleConfig)
export const ROLES = [
  "Developer",
  "Technical Lead",
  "Product Owner",
  "Business SPOC",
  "QA",
  "Intern",
] as const;

// Team Constraints (legacy)
export const MAX_TEAMS = 50;
export const MAX_APPROVED_TEAMS = 6;
export const MAX_TEAM_MEMBERS = 7;

// Phase Maximum Points (legacy)
export const PHASE_MAX_POINTS = {
  2: 25,
  3: 25,
  4: 50,
} as const;

export const ROLE_LIMITS: Record<string, number> = {
  Developer: 3,
  "Technical Lead": 1,
  "Product Owner": 1,
  "Business SPOC": 1,
  QA: 1,
  Intern: 1,
};

// Phases (legacy)
export const PHASES = [1, 2, 3, 4] as const;

// Scoring Weights (legacy)
export const SCORE_WEIGHTS = {
  aiUsage: 0.35,
  businessImpact: 0.25,
  ux: 0.15,
  innovation: 0.1,
  execution: 0.15,
} as const;

// Phase Weights (legacy)
export const PHASE_WEIGHTS = {
  1: 0,
  2: 0.25,
  3: 0.25,
  4: 0.50,
} as const;

// Timeline (legacy)
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

// Prizes (legacy)
export const PRIZES = [
  { rank: "1st Place", amount: 50000, color: "gold" as const },
  { rank: "2nd Place", amount: 40000, color: "silver" as const },
  { rank: "3rd Place", amount: 25000, color: "bronze" as const },
  { rank: "4th Place", amount: 15000, color: "copper" as const },
  { rank: "5th Place", amount: 10000, color: "steel" as const },
] as const;

// ============================================================
// DEFAULT VALUES FOR NEW CONTEST CREATION
// These are used to pre-populate fields when creating a new contest
// ============================================================

export const DEFAULT_SCORING_CRITERIA = [
  { name: "AI Utilization", key: "aiUtilization", weight: 0.20, description: "Effective use of AI tools, prompt quality, and understanding of how AI supported development." },
  { name: "Problem Understanding & Solution Fit", key: "problemUnderstanding", weight: 0.15, description: "Clarity of the problem and how well the solution addresses it." },
  { name: "Functionality & Prototype Execution", key: "functionalityExecution", weight: 0.10, description: "Demonstration of core workflows; effort and learning valued over completeness." },
  { name: "Innovation & Creativity", key: "innovationCreativity", weight: 0.10, description: "Unique ideas, enhancements, or thoughtful additions." },
  { name: "User Experience (UX/UI)", key: "uxUi", weight: 0.10, description: "Simplicity, usability, and visual clarity." },
  { name: "Presentation & Communication", key: "presentationCommunication", weight: 0.20, description: "Storytelling, clarity, confidence, structured explanation, and handling Q&A." },
  { name: "Team Collaboration & Role Ownership", key: "teamCollaboration", weight: 0.15, description: "Participation from members, clarity of responsibilities, and teamwork." },
];

export const DEFAULT_PHASE_CONFIG = [
  {
    phase: 1,
    name: "Team Formation & Nominations",
    maxPoints: 0,
    startDate: "",
    endDate: "",
    description: "Challenge begins! Team formation, nominations, and kickoff workshop.",
    details: [
      "Announcement emailed to all participants",
      "Team formation and role assignments",
      "Final teams published",
      "Track selection completed",
    ],
    deliverables: [
      "Kickoff Workshop: Intro to the Event",
      "Expectations & deliverables overview",
      "Judging process explained",
      "Q&A session",
    ],
  },
  {
    phase: 2,
    name: "The 'Vibe Coding' Sprint",
    maxPoints: 25,
    startDate: "",
    endDate: "",
    description: "Rapid AI-assisted development sprint with checkpoint demo.",
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
      "10-minute checkpoint demo to Mentor + Judges",
    ],
  },
  {
    phase: 3,
    name: "Mid-Point Review",
    maxPoints: 25,
    startDate: "",
    endDate: "",
    description: "Prototype progress review with alignment and feedback.",
    details: [
      "Prototype progress evaluation",
      "Alignment check",
      "AI usage evidence review",
      "Roadblocks identification",
    ],
    deliverables: [
      "In Progress Prototype",
      "Sprint progress update",
      "10-minute checkpoint demo to Mentor + Judges",
      "Committee provides actionable feedback",
    ],
  },
  {
    phase: 4,
    name: "Grand Finale – Demo Day",
    maxPoints: 50,
    startDate: "",
    endDate: "",
    description: "Final project completion, deployment, and comprehensive demo.",
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
    phase: 5,
    name: "Evaluation & Award Ceremony",
    maxPoints: 0,
    startDate: "",
    endDate: "",
    description: "Final evaluation and recognition of top performing teams.",
    details: [
      "Complete evaluation of all submissions",
      "Final scoring and ranking",
      "Award ceremony for top teams",
    ],
    deliverables: [],
  },
];

export const DEFAULT_PRIZES = [
  { rank: 1, label: "1st Place", amount: null, color: "gold" },
  { rank: 2, label: "2nd Place", amount: null, color: "silver" },
  { rank: 3, label: "3rd Place", amount: null, color: "bronze" },
];

export const DEFAULT_ROLE_CONFIG = [
  { role: "Developer", maxPerTeam: 3 },
  { role: "Team Lead", maxPerTeam: 1 },
  { role: "Product SPOC", maxPerTeam: 1 },
  { role: "Business SPOC", maxPerTeam: 1 },
  { role: "QA/Testing Owner", maxPerTeam: 1 },
];

export const DEFAULT_MAX_TEAMS = 50;
export const DEFAULT_MAX_APPROVED_TEAMS = 10;
export const DEFAULT_MAX_TEAM_MEMBERS = 7;

export const DEFAULT_PARTICIPANT_ROLES = [
  "Developer",
  "Team Lead",
  "Product SPOC",
  "Business SPOC",
  "QA/Testing Owner",
];
