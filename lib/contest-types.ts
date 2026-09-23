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
  scoringCriteria: Array<{ name: string; key: string; weight: number; description: string }>;
  phaseConfig: Array<{
    phase: number;
    name: string;
    maxPoints: number;
    startDate: string;
    endDate: string;
    description: string;
    details: string[];
    deliverables: string[];
  }>;
  submissionFields: SubmissionField[];
  scoringScale: ScoringScale;
  terminology: Terminology;
  roleConfig: Array<{ role: string; maxPerTeam: number }>;
  prizes: Array<{ rank: number; label: string; amount: number | null; color: string }>;
  maxTeamMembers: number;
  maxTeams: number;
  maxApprovedTeams: number;
  tracks: PresetTrack[];
  settings: ContestSettings;
  landing: LandingCopy;
  certificate: { eventName: string; bodyText: string };
  rules: { eligibilityRules: string; teamStructureRules: string; deliverableRules: string };
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
  settings: { exclusiveTracks: false, feedbackVisibility: "after_results", showcaseEnabled: false, assistantEnabled: true },
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
    { name: "Business Strategy Challenge", description: "Competitive strategy, growth plans and turnaround cases.", icon: "Target" },
    { name: "Marketing Innovation Challenge", description: "Brand, go-to-market and customer engagement innovation.", icon: "Megaphone" },
    { name: "Finance & FinTech Challenge", description: "Financial products, inclusion and FinTech business models.", icon: "Landmark" },
    { name: "HR & Organizational Excellence Challenge", description: "Talent, culture, future of work and people analytics.", icon: "Users" },
    { name: "Sustainability & ESG Challenge", description: "Green business models, circular economy and ESG strategy.", icon: "Leaf" },
    { name: "Startup Pitch Competition", description: "Early-stage startup ideas pitched as investable ventures.", icon: "Rocket" },
    { name: "Data Analytics Challenge", description: "Data-driven insights and decisions for a business problem.", icon: "BarChart3" },
    { name: "Digital Transformation Challenge", description: "Digitising processes, channels and business models.", icon: "Cpu" },
    { name: "Social Impact Innovation Challenge", description: "Scalable solutions for inclusion, education, health and livelihoods.", icon: "HeartHandshake" },
    { name: "AI for Business Challenge", description: "Applying AI to create measurable business value.", icon: "Sparkles" },
  ],
  settings: {
    exclusiveTracks: false,
    feedbackVisibility: "after_results",
    showcaseEnabled: true,
    assistantEnabled: true,
    theme: "Innovating for a Sustainable, Digital, and Inclusive Future",
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

export const CONTEST_PRESETS: Record<ContestType, ContestPreset> = {
  hackathon: HACKATHON,
  business_symposium: SYMPOSIUM,
};

export function getPreset(type: string | null | undefined): ContestPreset {
  return CONTEST_PRESETS[(type as ContestType) in CONTEST_PRESETS ? (type as ContestType) : "hackathon"];
}
