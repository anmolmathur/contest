/**
 * One-line "what this role does" for team roles (roleConfig[].summary).
 *
 * Organisers can set `summary` per role in Admin → Settings → Role
 * Configuration. When it is empty we fall back to a built-in one-liner for the
 * standard role names (Campus2Nation symposium "heist" roles, Ideathon crew
 * roles, the default symposium roles), then to the first sentence of the
 * role's longer `description`.
 */

const DEFAULT_ROLE_SUMMARIES: Record<string, string> = {
  // Campus2Nation AI Business Symposium / Ideathon crew roles
  "the mastermind": "Team captain: owns the idea, scope and deadlines, and leads the pitch.",
  "the bot whisperer": "AI and prompt specialist: makes the AI tools deliver the solution.",
  "the deal maker": "Business strategist: business model, pricing, go-to-market and who pays.",
  "the crowd puller": "Storyteller and presenter: builds the pitch deck and wins the audience.",
  "the insider": "Domain expert: makes sure the solution solves a real, practical problem.",
  "the systems hacker": "Technical builder: designs and builds the working prototype or demo.",
  "the evidence & ethics guardian": "Backs the idea with research, numbers and ROI, and checks responsible-AI risks.",
  "the evidence and ethics guardian": "Backs the idea with research, numbers and ROI, and checks responsible-AI risks.",
  "the numbers keeper": "Pulls the before/after data and builds the proof of impact.",
  "the shield": "Covers risk, data privacy (DPDP), guardrails and controls.",
  // Default business symposium roles
  "team lead": "Leads the team, coordinates the work and owns deadlines.",
  "research & strategy": "Researches the problem and market and shapes the strategy.",
  finance: "Builds the numbers: costs, revenue model and financial case.",
  marketing: "Plans positioning, go-to-market and customer outreach.",
  presenter: "Presents the pitch and handles the jury's questions.",
  // Default hackathon roles
  developer: "Writes and ships the code.",
  "technical lead": "Owns the architecture and technical decisions.",
  "product owner": "Defines what to build and why, and prioritises the work.",
  "business spoc": "Brings the business context and validates the solution with users.",
  qa: "Tests the solution and makes sure it works end to end.",
  intern: "Supports the team across building, testing and research.",
};

function firstSentence(text: string, max = 110): string {
  const t = text.trim().replace(/\s+/g, " ");
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  const s = m ? m[1] : t;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** The one-line summary to show for a role, or "" when nothing is known. */
export function roleSummary(rc: { role: string; summary?: string | null; description?: string | null }): string {
  const own = rc.summary?.trim();
  if (own) return own;
  const known = DEFAULT_ROLE_SUMMARIES[rc.role.trim().toLowerCase()];
  if (known) return known;
  return rc.description?.trim() ? firstSentence(rc.description) : "";
}
