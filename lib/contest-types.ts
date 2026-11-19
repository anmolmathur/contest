/**
 * Contest-type presets. A preset seeds a new contest (criteria, rounds,
 * submission fields, scale, vocabulary, roles, categories, landing copy,
 * certificate text). After creation every value is editable per contest —
 * the type itself only picks defaults and some copy fallbacks.
 *
 * Client-safe (no DB imports).
 */
import {
  DEFAULT_SCORING_CRITERIA,
  DEFAULT_PHASE_CONFIG,
  DEFAULT_PRIZES,
  DEFAULT_ROLE_CONFIG,
} from "@/lib/constants";
import type {
  ContestSettings,
  ContestType,
  ScoringScale,
  SubmissionField,
  Terminology,
} from "@/lib/contest-config";

export interface PresetTrack {
  name: string;
  description: string;
  icon?: string;
}

export interface LandingCopy {
  tracksHeading: string;
  tracksSubheading: string;
  prizesHeading: string;
  prizesSubheading: string;
  ctaHeading: string;
  ctaSubheading: string;
  fallbackBannerKeywords: string;
}

export interface ContestPreset {
  type: ContestType;
  label: string;
  tagline: string;
  description: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  /** `phases` limits a criterion to some stages (empty/undefined = every stage). */
  scoringCriteria: Array<{ name: string; key: string; weight: number; description: string; phases?: number[] }>;
  phaseConfig: Array<{
    phase: number;
    name: string;
    maxPoints: number;
    startDate: string;
    endDate: string;
    description: string;
    details: string[];
    deliverables: string[];
    /** Go / Go-with-changes / Out decision after this stage; "out" eliminates the team. */
    gate?: boolean;
    /** Validated impact metrics needed before this stage can be submitted. */
    requires?: Array<"baseline" | "actual">;
  }>;
  submissionFields: SubmissionField[];
  scoringScale: ScoringScale;
  terminology: Terminology;
  roleConfig: Array<{ role: string; maxPerTeam: number; minPerTeam?: number; description?: string; summary?: string }>;
  prizes: Array<{ rank: number; label: string; amount: number | null; color: string }>;
  maxTeamMembers: number;
  maxTeams: number;
  maxApprovedTeams: number;
  tracks: PresetTrack[];
  settings: ContestSettings;
  landing: LandingCopy;
  certificate: { eventName: string; bodyText: string };
  rules: { eligibilityRules: string; teamStructureRules: string; deliverableRules: string };
  /** Seeded into problem_statements on creation (Ideathon). Track = tracks[].name. */
  problemBank?: PresetProblem[];
  /** Category awards on top of ranked prizes. */
  awards?: ContestAward[];
}

export interface PresetProblem {
  title: string;
  description: string;
  track: string;
  ownerDepartment?: string;
  metricTemplate?: { metric: string; unit: string; direction: "increase" | "decrease" };
}

export interface ContestAward {
  key: string;
  label: string;
  description: string;
  amount: number | null;
  winnerTeamId?: string | null;
}

// ---------------------------------------------------------------------------
// Hackathon
// ---------------------------------------------------------------------------

const HACKATHON_FIELDS: SubmissionField[] = [
  {
    key: "scopeDocument",
    label: "Statement of Work / Scope",
    type: "file",
    required: true,
    phases: [2],
    accept: ".pdf,.doc,.docx,.ppt,.pptx",
    maxSizeMb: 25,
    helpText: "Scope, technical plan and prompt strategy (PDF/DOC/PPT).",
  },
  { key: "githubUrl", label: "GitHub Repository", type: "url", required: true, placeholder: "https://github.com/..." },
  { key: "demoUrl", label: "Live Demo URL", type: "url", required: true, phases: [3, 4], placeholder: "https://..." },
  {
    key: "submissionDescription",
    label: "What did you build?",
    type: "textarea",
    required: true,
    placeholder: "Summary of progress, key features and what changed since the last checkpoint.",
  },
  { key: "aiPromptsUsed", label: "AI Prompts Used", type: "textarea", required: true, placeholder: "Key prompts and what they produced" },
  {
    key: "aiToolsUtilized",
    label: "AI Tools Utilized",
    type: "textarea",
    required: true,
    placeholder: "ChatGPT, Copilot, Claude, Cursor, v0…",
  },
  {
    key: "aiScreenshots",
    label: "AI Usage Screenshots",
    type: "fileList",
    required: true,
    accept: ".png,.jpg,.jpeg,.webp,.gif",
    maxSizeMb: 10,
    helpText: "Upload screenshots as evidence of AI-assisted development.",
  },
  {
    key: "finalDeck",
    label: "Final Presentation Deck",
    type: "file",
    required: true,
    phases: [4],
    accept: ".pdf,.ppt,.pptx",
    maxSizeMb: 25,
  },
  { key: "demoVideoUrl", label: "Demo Video (optional)", type: "url", required: false, phases: [4], placeholder: "YouTube / Drive link" },
];

const HACKATHON: ContestPreset = {
  type: "hackathon",
  label: "Hackathon",
  tagline: "Technical build challenge",
  description: "Teams build working software over timed sprints. Judged on AI usage, execution, UX and the final demo.",
  heroTitle: "AI Innovation Challenge",
  heroSubtitle: "Build real solutions with AI-assisted development",
  heroCtaText: "Register Now",
  scoringCriteria: DEFAULT_SCORING_CRITERIA,
  phaseConfig: DEFAULT_PHASE_CONFIG,
  submissionFields: HACKATHON_FIELDS,
  scoringScale: { min: 0, max: 100, step: 1 },
  terminology: { track: "Track", phase: "Phase", judge: "Judge", submission: "Submission" },
  roleConfig: DEFAULT_ROLE_CONFIG,
  prizes: DEFAULT_PRIZES,
  maxTeamMembers: 7,
  maxTeams: 50,
  maxApprovedTeams: 10,
  tracks: [],
  settings: {
    exclusiveTracks: false,
    feedbackVisibility: "after_results",
    showcaseEnabled: false,
    assistantEnabled: true,
    colorMode: "dark",
  },
  landing: {
    tracksHeading: "Choose Your Track",
    tracksSubheading: "Pick the problem you want to solve",
    prizesHeading: "Prizes",
    prizesSubheading: "Compete for recognition and rewards",
    ctaHeading: "Ready to Build?",
    ctaSubheading: "Form your team and showcase what you can build with AI.",
    fallbackBannerKeywords: "artificial-intelligence,technology,code",
  },
  certificate: {
    eventName: "AI Innovation Challenge",
    bodyText: "in recognition of outstanding contribution, innovation and excellence in AI-powered development.",
  },
  rules: {
    eligibilityRules: "",
    teamStructureRules: "",
    deliverableRules: "",
  },
};

// ---------------------------------------------------------------------------
// Business Symposium (per "Business Symposium – Concept Note")
// ---------------------------------------------------------------------------

const SYMPOSIUM_FIELDS: SubmissionField[] = [
  {
    key: "executiveSummary",
    label: "Executive Summary",
    type: "textarea",
    required: true,
    placeholder: "Your idea in 150–250 words: the problem, your solution and why it matters.",
  },
  {
    key: "problemStatement",
    label: "Problem Identification & Relevance",
    type: "textarea",
    required: true,
    phases: [2],
    placeholder: "What business problem are you solving? Who faces it, and how big is it?",
  },
  {
    key: "targetMarket",
    label: "Target Market & Customer",
    type: "textarea",
    required: true,
    phases: [2, 3],
    placeholder: "Customer segments, market size (TAM/SAM/SOM), key competitors.",
  },
  {
    key: "valueProposition",
    label: "Proposed Solution & Value Proposition",
    type: "textarea",
    required: true,
    phases: [2],
  },
  {
    key: "businessModel",
    label: "Business Model & Revenue Streams",
    type: "textarea",
    required: true,
    phases: [3, 4],
    placeholder: "How does it make money? Pricing, channels, cost structure, unit economics.",
  },
  {
    key: "sustainabilityImpact",
    label: "Sustainability & Social Impact",
    type: "textarea",
    required: false,
    phases: [3],
    placeholder: "ESG / inclusion / sustainability considerations.",
  },
  {
    key: "marketResearch",
    label: "Market Research Report",
    type: "file",
    required: true,
    phases: [3],
    accept: ".pdf,.doc,.docx",
    maxSizeMb: 25,
    helpText: "Primary/secondary research findings, surveys, data sources (PDF).",
  },
  {
    key: "financialModel",
    label: "Financial Model",
    type: "file",
    required: false,
    phases: [3, 4],
    accept: ".xlsx,.xls,.csv,.pdf",
    maxSizeMb: 25,
    helpText: "3-year projections, break-even and key assumptions.",
  },
  {
    key: "pitchDeck",
    label: "Pitch Deck",
    type: "file",
    required: true,
    phases: [3, 4],
    accept: ".pdf,.ppt,.pptx",
    maxSizeMb: 25,
    helpText: "10–12 slides. The finale deck is what the jury sees on stage.",
  },
  {
    key: "pitchVideoUrl",
    label: "Pitch Video (optional)",
    type: "url",
    required: false,
    phases: [4],
    placeholder: "3-minute video link (YouTube / Drive)",
  },
  {
    key: "prototypeUrl",
    label: "Prototype / Mock-up Link (optional)",
    type: "url",
    required: false,
    phases: [3, 4],
    placeholder: "Figma, landing page, app mock-up…",
  },
];

const SYMPOSIUM: ContestPreset = {
  type: "business_symposium",
  label: "Business Symposium",
  tagline: "Pitch-based business challenge",
  description:
    "Student teams solve real business challenges and pitch to an industry jury — plus keynotes, panels and an innovation showcase.",
  heroTitle: "Business Symposium",
  heroSubtitle: "Innovating for a Sustainable, Digital, and Inclusive Future",
  heroCtaText: "Register Your Team",
  scoringCriteria: [
    {
      name: "Innovation & Creativity",
      key: "innovationCreativity",
      weight: 0.2,
      description: "Originality of the idea and approach; sustainability considerations built into the solution.",
    },
    {
      name: "Problem Relevance",
      key: "problemRelevance",
      weight: 0.15,
      description: "Clear problem identification and its relevance to a real business or social need.",
    },
    {
      name: "Business Feasibility",
      key: "businessFeasibility",
      weight: 0.15,
      description: "Feasibility, scalability and financial viability of the business model.",
    },
    {
      name: "Market Potential",
      key: "marketPotential",
      weight: 0.15,
      description: "Size of the opportunity, customer understanding and business impact.",
    },
    {
      name: "Presentation Skills",
      key: "presentationSkills",
      weight: 0.1,
      description: "Storytelling, structure, clarity and confidence of the pitch.",
    },
    {
      name: "Research Quality",
      key: "researchQuality",
      weight: 0.1,
      description: "Depth of market research and data-driven decision making.",
    },
    {
      name: "Q&A Handling",
      key: "qaHandling",
      weight: 0.1,
      description: "Understanding of the business shown while answering jury questions.",
    },
    {
      name: "Team Collaboration",
      key: "teamCollaboration",
      weight: 0.05,
      description: "Participation, clarity of roles and teamwork.",
    },
  ],
  phaseConfig: [
    {
      phase: 1,
      name: "Registration & Team Formation",
      maxPoints: 0,
      startDate: "",
      endDate: "",
      description: "Register, form teams of up to 5 and pick a competition category.",
      details: ["Orientation session on the symposium format", "Team formation and role allocation", "Category selection"],
      deliverables: ["Team registered with a category"],
    },
    {
      phase: 2,
      name: "Concept Note Screening",
      maxPoints: 20,
      startDate: "",
      endDate: "",
      description: "Submit a concept note describing the problem, target market and proposed solution.",
      details: ["Problem identification", "Initial market understanding", "Value proposition"],
      deliverables: ["Executive summary", "Problem statement", "Target market", "Value proposition"],
    },
    {
      phase: 3,
      name: "Business Plan & Mentor Review",
      maxPoints: 30,
      startDate: "",
      endDate: "",
      description: "Develop the full business plan with market research and a financial model; get mentor and jury feedback.",
      details: ["Market research", "Business model and financials", "Mentor review session"],
      deliverables: ["Market research report", "Business model", "Financial model", "Draft pitch deck"],
    },
    {
      phase: 4,
      name: "Grand Finale – Live Pitch to Industry Jury",
      maxPoints: 50,
      startDate: "",
      endDate: "",
      description: "Shortlisted teams pitch live to the industry jury: 7-minute pitch + 3-minute Q&A.",
      details: ["Live pitch on stage", "Jury Q&A", "Innovation showcase"],
      deliverables: ["Final pitch deck", "7-minute pitch", "3-minute Q&A"],
    },
    {
      phase: 5,
      name: "Awards & Networking",
      maxPoints: 0,
      startDate: "",
      endDate: "",
      description: "Results, awards and networking with industry leaders, recruiters and investors.",
      details: ["Award ceremony", "Networking & industry connect"],
      deliverables: [],
    },
  ],
  submissionFields: SYMPOSIUM_FIELDS,
  scoringScale: {
    min: 1,
    max: 10,
    step: 1,
    labels: [
      { min: 9, max: 10, label: "Exceptional" },
      { min: 7, max: 8, label: "Strong" },
      { min: 5, max: 6, label: "Average" },
      { min: 3, max: 4, label: "Weak" },
      { min: 1, max: 2, label: "Poor" },
    ],
  },
  terminology: { track: "Category", phase: "Round", judge: "Jury", submission: "Entry", team: "Team" },
  roleConfig: [
    { role: "Team Lead", maxPerTeam: 1 },
    { role: "Research & Strategy", maxPerTeam: 2 },
    { role: "Finance", maxPerTeam: 1 },
    { role: "Marketing", maxPerTeam: 1 },
    { role: "Presenter", maxPerTeam: 1 },
  ],
  prizes: [
    { rank: 1, label: "Winner", amount: null, color: "gold" },
    { rank: 2, label: "1st Runner-up", amount: null, color: "silver" },
    { rank: 3, label: "2nd Runner-up", amount: null, color: "bronze" },
  ],
  maxTeamMembers: 5,
  maxTeams: 100,
  maxApprovedTeams: 20,
  tracks: [
    { name: "Business Strategy Challenge", description: "Competitive strategy, growth plans and turnaround cases.", icon: "🎯" },
    { name: "Marketing Innovation Challenge", description: "Brand, go-to-market and customer engagement innovation.", icon: "📣" },
    { name: "Finance & FinTech Challenge", description: "Financial products, inclusion and FinTech business models.", icon: "🏦" },
    { name: "HR & Organizational Excellence Challenge", description: "Talent, culture, future of work and people analytics.", icon: "🧑‍🤝‍🧑" },
    { name: "Sustainability & ESG Challenge", description: "Green business models, circular economy and ESG strategy.", icon: "🌱" },
    { name: "Startup Pitch Competition", description: "Early-stage startup ideas pitched as investable ventures.", icon: "🚀" },
    { name: "Data Analytics Challenge", description: "Data-driven insights and decisions for a business problem.", icon: "📊" },
    { name: "Digital Transformation Challenge", description: "Digitising processes, channels and business models.", icon: "💻" },
    { name: "Social Impact Innovation Challenge", description: "Scalable solutions for inclusion, education, health and livelihoods.", icon: "🤝" },
    { name: "AI for Business Challenge", description: "Applying AI to create measurable business value.", icon: "🤖" },
  ],
  settings: {
    exclusiveTracks: false,
    feedbackVisibility: "after_results",
    showcaseEnabled: true,
    assistantEnabled: true,
    theme: "Innovating for a Sustainable, Digital, and Inclusive Future",
    colorMode: "light",
  },
  landing: {
    tracksHeading: "Competition Categories",
    tracksSubheading: "Choose the business challenge your team will solve",
    prizesHeading: "Awards & Recognition",
    prizesSubheading: "Recognition from industry leaders, plus internship and placement opportunities",
    ctaHeading: "Ready to Pitch?",
    ctaSubheading: "Form your team, solve a real business challenge and pitch to an industry jury.",
    fallbackBannerKeywords: "business,conference,startup",
  },
  certificate: {
    eventName: "Business Symposium",
    bodyText: "in recognition of excellence in business innovation, analytical thinking and entrepreneurial leadership.",
  },
  rules: {
    eligibilityRules:
      "Open to undergraduate and postgraduate students (including MBA, management, engineering and technology programmes). Teams may be inter-disciplinary.",
    teamStructureRules:
      "Teams of 3–5 members. Every team needs a Team Lead and a Presenter; recommended roles are Research & Strategy, Finance and Marketing.",
    deliverableRules:
      "Round 2: concept note. Round 3: market research, business model, financial model and draft deck. Finale: final pitch deck, 7-minute pitch and 3-minute Q&A.",
  },
};

// ---------------------------------------------------------------------------
// Ideathon (first edition: TLE AIdeathon 2026)
// ---------------------------------------------------------------------------

export const IDEATHON_SOLUTION_PATHS = [
  "Process Re-engineering",
  "System Change",
  "Agent Build",
  "Tool Purchase",
];

export const IDEATHON_DEPARTMENTS = [
  "Admissions & Counselling",
  "Marketing",
  "University Operations",
  "Academics & Content",
  "Examinations",
  "Student Success",
  "Finance",
  "HR & People",
  "Technology",
  "Product",
  "Enterprise & B2B",
  "Impact & CSR",
  "Legal & Compliance",
];

const IDEATHON_FIELDS: SubmissionField[] = [
  {
    key: "problemCanvas",
    label: "Problem Canvas",
    type: "textarea",
    required: true,
    phases: [1],
    placeholder:
      "Who is hurting, how often and how much? What does today's process look like? What is the number today (X) and what should it be (Y)?",
  },
  {
    key: "solutionIdea",
    label: "Solution Idea",
    type: "textarea",
    required: true,
    phases: [1],
    placeholder: "What will you change? Which people, process, systems, agents or tools are involved?",
  },
  {
    key: "solutionPaths",
    label: "Solution Paths",
    type: "multiselect",
    required: true,
    phases: [1, 2],
    options: IDEATHON_SOLUTION_PATHS,
    helpText: "Pick every path your solution uses. A non-tech solution (Process Re-engineering) is perfectly valid.",
  },
  {
    key: "expectedValue",
    label: "Expected Value to TLE",
    type: "textarea",
    required: true,
    phases: [1],
    placeholder:
      "One-time value (₹, hours, risk avoided) and the recurring value per year if this becomes the new normal. Show your maths.",
  },
  {
    key: "pitchDeck",
    label: "Pitch Deck",
    type: "file",
    required: true,
    phases: [1, 5],
    accept: ".pdf,.ppt,.pptx",
    maxSizeMb: 25,
    helpText: "Idea Pitch: 5 slides, 5 minutes. Reveal: final deck with validated before/after.",
  },
  {
    key: "conditionsResponse",
    label: "How you met the Idea Pitch conditions",
    type: "textarea",
    required: false,
    phases: [2],
    helpText: "Only if the jury said Go-with-changes.",
  },
  {
    key: "solutionDesign",
    label: "Solution Blueprint",
    type: "textarea",
    required: true,
    phases: [2],
    placeholder: "New process (steps, owners, hand-offs), what changes in which system, where AI/agents fit, what stays human.",
  },
  {
    key: "processMap",
    label: "Process Map (before → after)",
    type: "file",
    required: false,
    phases: [2],
    accept: ".pdf,.png,.jpg,.jpeg,.pptx",
    maxSizeMb: 15,
  },
  {
    key: "systemChangeSpec",
    label: "System Change Spec",
    type: "textarea",
    required: false,
    requiredForPaths: ["System Change"],
    phases: [2],
    placeholder: "Which system (CRM/UMS/LMS/Empower/…), which configuration or feature, who approves, rollback plan.",
  },
  {
    key: "agentCharter",
    label: "Agent Charter",
    type: "agentCharter",
    required: false,
    requiredForPaths: ["Agent Build"],
    phases: [2, 3, 4, 5],
    helpText: "One row per agent: what it does, how autonomous it is, where a human checks it, and what it costs.",
  },
  {
    key: "toolBusinessCase",
    label: "Tool Business Case",
    type: "file",
    required: false,
    requiredForPaths: ["Tool Purchase"],
    phases: [2],
    accept: ".pdf,.xlsx,.pptx,.docx",
    maxSizeMb: 25,
    helpText: "Vendor comparison, commercials, payback period, security/DPDP check.",
  },
  {
    key: "buildSummary",
    label: "What did you build or change?",
    type: "textarea",
    required: true,
    phases: [3, 4],
  },
  { key: "demoUrl", label: "Demo link", type: "url", required: false, phases: [3, 4, 5], placeholder: "https://…" },
  { key: "demoVideoUrl", label: "Demo video", type: "url", required: false, phases: [3, 5], placeholder: "Drive / YouTube link" },
  {
    key: "adoptionEvidence",
    label: "Adoption Evidence",
    type: "textarea",
    required: true,
    phases: [4, 5],
    placeholder: "How many real users/cases ran through the new way? Usage numbers, feedback, what broke and what you fixed.",
  },
  {
    key: "runLog",
    label: "Live-run log / data extract",
    type: "file",
    required: false,
    phases: [4],
    accept: ".pdf,.xlsx,.csv",
    maxSizeMb: 25,
  },
  {
    key: "sustainabilityPlan",
    label: "Sustainability Plan",
    type: "textarea",
    required: true,
    phases: [5],
    placeholder: "Who owns it from Monday? What keeps it running? What does it cost to run per month?",
  },
];

const IDEATHON: ContestPreset = {
  type: "ideathon",
  label: "Ideathon",
  tagline: "Idea → proof of value",
  description:
    "Cross-functional crews take a real business problem, fix it with process, systems, AI agents or tools, and prove the before/after with validated numbers.",
  heroTitle: "Ideathon",
  heroSubtitle: "Pick a real problem. Fix it. Prove it with numbers.",
  heroCtaText: "Form Your Crew",
  scoringCriteria: [
    {
      name: "Expected Value to TLE",
      key: "expectedValue",
      weight: 0.3,
      phases: [1],
      description: "Size of the prize: one-time value plus recurring yearly value if it works.",
    },
    {
      name: "Problem Significance",
      key: "problemSignificance",
      weight: 0.2,
      phases: [1],
      description: "How painful, frequent and widespread the problem is today.",
    },
    {
      name: "Solution Idea & Path Fit",
      key: "solutionFit",
      weight: 0.2,
      phases: [1],
      description: "Does the idea attack the root cause? Are the chosen paths the right ones?",
    },
    {
      name: "Measurability",
      key: "measurability",
      weight: 0.1,
      phases: [1],
      description: "Can the before and after be proven with system data?",
    },
    {
      name: "Feasibility in 5 Weeks",
      key: "feasibility",
      weight: 0.1,
      phases: [1],
      description: "Can this crew get it live and measured within the contest?",
    },
    {
      name: "Tech & AI Agents Angle",
      key: "techAiAngle",
      weight: 0.1,
      phases: [1],
      description: "Smart use of our systems, automation or AI agents (not required, but rewarded).",
    },
    {
      name: "Value to TLE (validated)",
      key: "valueToTle",
      weight: 0.35,
      phases: [2, 3, 4, 5],
      description: "Validated absolute value realised plus future recurring value per year.",
    },
    {
      name: "Adoption & Sustainability",
      key: "adoptionSustainability",
      weight: 0.25,
      phases: [2, 3, 4, 5],
      description: "Real users on the new way, an owner in place, and it keeps running after the contest.",
    },
    {
      name: "AI & Tech Solution",
      key: "aiTechSolution",
      weight: 0.2,
      phases: [2, 3, 4, 5],
      description: "Quality of the solution: process design, smart use of existing systems, AI/agent depth where used.",
    },
    {
      name: "Safety & Governance",
      key: "safetyGovernance",
      weight: 0.1,
      phases: [2, 3, 4, 5],
      description: "Data protection (DPDP), controls, human checkpoints, rollback.",
    },
    {
      name: "Reuse & Scale",
      key: "reuseScale",
      weight: 0.1,
      phases: [2, 3, 4, 5],
      description: "Can other departments, universities or teams use it too?",
    },
  ],
  phaseConfig: [
    {
      phase: 1,
      name: "Mission Briefing → Idea Pitch",
      maxPoints: 10,
      startDate: "",
      endDate: "",
      gate: true,
      description:
        "Launch, AI & tools bootcamp, crew formation and problem pick. Ends with a 5-minute Idea Pitch: the jury says Go, Go-with-changes or Out.",
      details: ["Bootcamp on the Sandbox Kit", "Form a cross-functional crew", "Claim a bank problem or propose your own", "Friday: Idea Pitch"],
      deliverables: ["Problem Canvas", "Solution idea & paths", "Expected value", "5-slide pitch deck"],
    },
    {
      phase: 2,
      name: "Blueprint",
      maxPoints: 15,
      startDate: "",
      endDate: "",
      requires: ["baseline"],
      description: "Lock the baseline with an Auditor and design the solution for every path you chose.",
      details: ["Baseline metrics validated by Data/BI", "Before → after process map", "System change spec / Agent Charter / tool business case"],
      deliverables: ["Validated baseline", "Solution Blueprint", "Response to pitch conditions"],
    },
    {
      phase: 3,
      name: "The Build",
      maxPoints: 15,
      startDate: "",
      endDate: "",
      description: "Re-engineer, configure, build or trial. Demo it working.",
      details: ["Tech Buddy office hours twice a week", "Sandbox access to systems and AI tools"],
      deliverables: ["Build summary", "Demo link or video"],
    },
    {
      phase: 4,
      name: "The Job (Live Run)",
      maxPoints: 20,
      startDate: "",
      endDate: "",
      description: "Two weeks live with real users. Submit actuals for validation; Finance values the result.",
      details: ["Run in production or a controlled pilot", "Track usage and adoption", "Submit actual numbers + evidence"],
      deliverables: ["Adoption evidence", "Actuals submitted for validation"],
    },
    {
      phase: 5,
      name: "The Reveal (Grand Finale)",
      maxPoints: 40,
      startDate: "",
      endDate: "",
      requires: ["actual"],
      description: "Present the validated before/after and the value to TLE. Final ranking and awards.",
      details: ["7-minute pitch + 3-minute jury Q&A", "Validated numbers only"],
      deliverables: ["Final deck", "Sustainability plan"],
    },
  ],
  submissionFields: IDEATHON_FIELDS,
  scoringScale: {
    min: 1,
    max: 10,
    step: 1,
    labels: [
      { min: 9, max: 10, label: "Exceptional" },
      { min: 7, max: 8, label: "Strong" },
      { min: 5, max: 6, label: "Average" },
      { min: 3, max: 4, label: "Weak" },
      { min: 1, max: 2, label: "Poor" },
    ],
  },
  terminology: {
    track: "Value Lens",
    team: "Crew",
    phase: "Stage",
    judge: "Jury",
    submission: "Entry",
    validator: "Auditor",
  },
  roleConfig: [
    { role: "The Mastermind", minPerTeam: 1, maxPerTeam: 1, description: "Problem owner and crew captain; leads the pitch." },
    { role: "The Insider", minPerTeam: 1, maxPerTeam: 5, description: "Knows today's process inside out; redesigns it and the human checkpoints." },
    { role: "The Bot Whisperer", minPerTeam: 1, maxPerTeam: 5, description: "Tech/AI builder: configures tools, builds agents or automations." },
    { role: "The Systems Hacker", minPerTeam: 1, maxPerTeam: 5, description: "Knows our systems; makes changes or finds features nobody uses." },
    { role: "The Deal Maker", minPerTeam: 1, maxPerTeam: 5, description: "Business case, vendor or cost analysis, value sizing." },
    { role: "The Numbers Keeper", minPerTeam: 1, maxPerTeam: 5, description: "Pulls baseline and after data; builds the proof." },
    { role: "The Crowd Puller", minPerTeam: 1, maxPerTeam: 5, description: "Gets real users onto the new way during the live run." },
    { role: "The Shield", minPerTeam: 1, maxPerTeam: 5, description: "Risk, DPDP, guardrails and controls." },
  ],
  prizes: [
    { rank: 1, label: "Winner", amount: 100000, color: "gold" },
    { rank: 2, label: "1st Runner-up", amount: 60000, color: "silver" },
    { rank: 3, label: "2nd Runner-up", amount: 40000, color: "bronze" },
  ],
  awards: [
    { key: "bigScore", label: "The Big Score", description: "Highest validated value to TLE", amount: 15000 },
    { key: "bestBot", label: "Best Bot", description: "Best AI agent", amount: 15000 },
    { key: "insideJob", label: "The Inside Job", description: "Best process re-engineering or re-use of existing tools", amount: 15000 },
    { key: "smartestDeal", label: "Smartest Deal", description: "Best tool business case", amount: 15000 },
    { key: "theShield", label: "The Shield", description: "Best safeguard / risk solution", amount: 15000 },
    { key: "bestCrew", label: "Best Crew", description: "Best cross-functional teamwork and adoption", amount: 15000 },
  ],
  maxTeamMembers: 10,
  maxTeams: 80,
  maxApprovedTeams: 40,
  tracks: [
    { name: "Revenue Growth", description: "More admissions, conversions, renewals and upsell.", icon: "📈" },
    { name: "Cost Reduction", description: "Spend less per lead, per student, per process.", icon: "💰" },
    { name: "Process Excellence", description: "Cut turnaround time and manual effort.", icon: "⚙️" },
    { name: "Safeguard", description: "Risk, compliance, DPDP, security and leakage.", icon: "🛡️" },
    { name: "Adoption Unlock", description: "Get value from features and tools we already own.", icon: "🔓" },
    { name: "Student & Customer Experience", description: "Faster answers, fewer drop-offs, happier students.", icon: "🎓" },
    { name: "Decision Intelligence", description: "Right numbers, to the right person, without Excel.", icon: "🧭" },
  ],
  problemBank: [
    {
      title: "Cut student admission TAT",
      description: "Time from application submitted to admission confirmed is X days. Bring it to Y days.",
      track: "Process Excellence",
      ownerDepartment: "University Operations",
      metricTemplate: { metric: "Admission TAT", unit: "days", direction: "decrease" },
    },
    {
      title: "Reduce RNR (ring-no-response) at a university",
      description: "X% of counselling calls to leads of University Z go unanswered. Bring it to Y%.",
      track: "Revenue Growth",
      ownerDepartment: "Admissions & Counselling",
      metricTemplate: { metric: "RNR rate", unit: "%", direction: "decrease" },
    },
    {
      title: "Lift lead-to-enrolment conversion",
      description: "Conversion for University Z / programme P is X%. Lift it to Y%.",
      track: "Revenue Growth",
      ownerDepartment: "Admissions & Counselling",
      metricTemplate: { metric: "Lead-to-enrolment conversion", unit: "%", direction: "increase" },
    },
    {
      title: "Cut payment drop-off at fee payment",
      description: "X% of students who reach the payment step do not pay. Bring it to Y%.",
      track: "Revenue Growth",
      ownerDepartment: "Finance",
      metricTemplate: { metric: "Payment drop-off", unit: "%", direction: "decrease" },
    },
    {
      title: "Cut pre-exam setup time",
      description: "Setting up one exam takes ~12 hours of manual work. Bring it to Y hours or less.",
      track: "Process Excellence",
      ownerDepartment: "Examinations",
      metricTemplate: { metric: "Setup time per exam", unit: "hours", direction: "decrease" },
    },
    {
      title: "More counselor calls through CRM",
      description: "Only X% of counselor calls are made through CRM. Lift it to Y%.",
      track: "Adoption Unlock",
      ownerDepartment: "Admissions & Counselling",
      metricTemplate: { metric: "Calls via CRM", unit: "%", direction: "increase" },
    },
    {
      title: "Adopt the CRM features we already have",
      description: "Smart views, auto-dialer and the counselor app are used by X% of users. Lift it to Y%.",
      track: "Adoption Unlock",
      ownerDepartment: "Admissions & Counselling",
      metricTemplate: { metric: "Active feature users", unit: "%", direction: "increase" },
    },
    {
      title: "Reduce LMS student drop-off",
      description: "X% of students at University Z stop engaging with the LMS. Bring it to Y%.",
      track: "Student & Customer Experience",
      ownerDepartment: "Student Success",
      metricTemplate: { metric: "LMS drop-off", unit: "%", direction: "decrease" },
    },
    {
      title: "Faster monthly MIS close",
      description: "Monthly MIS takes X days after month-end. Bring it to Y days.",
      track: "Decision Intelligence",
      ownerDepartment: "Finance",
      metricTemplate: { metric: "MIS close time", unit: "days", direction: "decrease" },
    },
    {
      title: "Cut document verification TAT",
      description: "Verifying one student's documents takes X. Bring it to Y.",
      track: "Process Excellence",
      ownerDepartment: "University Operations",
      metricTemplate: { metric: "Verification TAT", unit: "hours", direction: "decrease" },
    },
    {
      title: "Lift year-2 fee renewal",
      description: "X% of year-1 students at University Z renew. Lift it to Y%.",
      track: "Revenue Growth",
      ownerDepartment: "Student Success",
      metricTemplate: { metric: "Renewal rate", unit: "%", direction: "increase" },
    },
    {
      title: "Cut cost per enrolment",
      description: "Telephony, cloud and messaging cost ₹X per enrolment. Cut it by Y%.",
      track: "Cost Reduction",
      ownerDepartment: "Technology",
      metricTemplate: { metric: "Cost per enrolment", unit: "₹", direction: "decrease" },
    },
    {
      title: "DPDP consent coverage",
      description: "X% of student-facing systems capture and log consent. Bring it to 100%.",
      track: "Safeguard",
      ownerDepartment: "Legal & Compliance",
      metricTemplate: { metric: "Systems with consent logging", unit: "%", direction: "increase" },
    },
  ],
  settings: {
    exclusiveTracks: false,
    feedbackVisibility: "after_results",
    showcaseEnabled: true,
    assistantEnabled: true,
    colorMode: "dark",
    departments: IDEATHON_DEPARTMENTS,
    minDepartmentsPerTeam: 2,
    minTeamMembers: 3,
    problemBankEnabled: true,
    solutionPaths: IDEATHON_SOLUTION_PATHS,
    impactMetricsEnabled: true,
  },
  landing: {
    tracksHeading: "Value Lenses",
    tracksSubheading: "Every idea must move one of these needles",
    prizesHeading: "Prizes & Awards",
    prizesSubheading: "One winner, two runners-up, and six category awards",
    ctaHeading: "Got a problem worth fixing?",
    ctaSubheading: "Form a cross-functional crew, fix it, and prove it with numbers.",
    fallbackBannerKeywords: "teamwork,innovation,office",
  },
  certificate: {
    eventName: "Ideathon",
    bodyText: "in recognition of turning an idea into measurable value for the organisation.",
  },
  rules: {
    eligibilityRules:
      "Open to all employees. Crews must include people from at least 2 departments. Tech team members may join crews or act as Tech Buddies (mentors), not both.",
    teamStructureRules:
      "Crews of 3–10. Every Heist role (Mastermind, Insider, Bot Whisperer, Systems Hacker, Deal Maker, Numbers Keeper, Crowd Puller, Shield) must be covered by at least one member; one person can play several roles.",
    deliverableRules:
      "Stage 1: Problem Canvas + Idea Pitch (jury decides Go / Go-with-changes / Out). Stage 2: validated baseline + blueprint. Stage 3: build/demo. Stage 4: live run + validated actuals. Stage 5: The Reveal with validated before/after. Only numbers validated by an Auditor count.",
  },
};

export const CONTEST_PRESETS: Record<ContestType, ContestPreset> = {
  hackathon: HACKATHON,
  business_symposium: SYMPOSIUM,
  ideathon: IDEATHON,
};

export function getPreset(type: string | null | undefined): ContestPreset {
  return CONTEST_PRESETS[(type as ContestType) in CONTEST_PRESETS ? (type as ContestType) : "hackathon"];
}
