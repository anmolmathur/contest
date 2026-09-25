/**
 * Ideathon stakeholder playbooks — who does what, and when. One content
 * source for the in-app /c/[slug]/playbook page and the PDF export.
 *
 * Text may use tokens that are replaced with the contest's own vocabulary:
 * {crew} {crews} {jury} {auditor} {auditors} {stage} {lens} {entry}
 * `stage` on a step links it to phaseConfig[].phase so the page can show real
 * dates and highlight "this week"; stage 0 = before launch.
 */

export type StakeholderKey = "participant" | "jury" | "auditor" | "tech-buddy" | "sponsor" | "organiser";

export interface PlaybookStep {
  /** 0 = before launch; otherwise phaseConfig phase number. */
  stage: number;
  when: string;
  what: string;
  where: string;
  output: string;
}

export interface Playbook {
  key: StakeholderKey;
  title: string;
  who: string;
  summary: string;
  roleCards?: Array<{ role: string; does: string[] }>;
  steps: PlaybookStep[];
  dos: string[];
  donts: string[];
  faqs: Array<{ q: string; a: string }>;
}

export const STAKEHOLDER_ORDER: StakeholderKey[] = ["participant", "jury", "auditor", "tech-buddy", "sponsor", "organiser"];

export const IDEATHON_PLAYBOOKS: Record<StakeholderKey, Playbook> = {
  participant: {
    key: "participant",
    title: "Participants",
    who: "Every employee in a {crew}",
    summary:
      "Form a cross-functional {crew}, pick a real problem, fix it with whatever works (process, systems, AI agents or a tool), run it live and prove the before/after with validated numbers.",
    roleCards: [
      { role: "The Mastermind", does: ["Owns the problem and captains the {crew}", "Leads the Idea Pitch and the Reveal", "Makes sure every deadline is met"] },
      { role: "The Insider", does: ["Maps today's process step by step", "Designs the new process and the human checkpoints"] },
      { role: "The Bot Whisperer", does: ["Configures tools, builds agents or automations", "Fills in the Agent Charter if the {crew} builds agents"] },
      { role: "The Systems Hacker", does: ["Knows CRM / UMS / LMS / Empower", "Finds features nobody uses; specifies system changes"] },
      { role: "The Deal Maker", does: ["Sizes the value in ₹", "Writes the vendor business case if you trial a tool"] },
      { role: "The Numbers Keeper", does: ["Pulls the baseline and after numbers from source systems", "Attaches evidence the {auditor} can check"] },
      { role: "The Crowd Puller", does: ["Gets real users onto the new way in the live run", "Collects usage and feedback"] },
      { role: "The Shield", does: ["Checks DPDP, data access and guardrails", "Makes sure there is a rollback plan"] },
    ],
    steps: [
      { stage: 1, when: "Day 1–2", what: "Sign in, set your department, pick every role you can play. Join or form a {crew} of 3–10 from at least 2 departments.", where: "Dashboard → Your {crew}", output: "{crew} checklist all green" },
      { stage: 1, when: "Day 2–3", what: "Attend the AI & tools bootcamp. Get your sandbox access (OpenWebUI workspace, n8n, masked Snowflake).", where: "Bootcamp invite / Tech Buddy", output: "Sandbox logins working" },
      { stage: 1, when: "Day 2–4", what: "Claim a problem from the Problem Bank or propose your own as a measurable outcome (“from X to Y”).", where: "Problem Bank", output: "Problem claimed / proposal approved" },
      { stage: 1, when: "Day 4", what: "Submit the Idea Pitch {entry}: Problem Canvas, solution idea, solution paths, expected value, 5-slide deck.", where: "Dashboard → Submit {entry}", output: "Stage 1 {entry} submitted" },
      { stage: 1, when: "Day 5 (Friday)", what: "Pitch for 5 minutes. The {jury} decides Go, Go-with-changes (you agree the changes) or Out.", where: "Pitch room / video call", output: "Decision on your dashboard" },
      { stage: 2, when: "Early in the week", what: "Add your metric(s): name, unit, source system, method, baseline value, period and evidence. Submit the baseline to an {auditor}.", where: "Dashboard → Before/After panel", output: "Baseline submitted" },
      { stage: 2, when: "By end of week", what: "Get the baseline validated (fix and resubmit if it is sent back). Submit the Blueprint: new process, system change spec, Agent Charter or tool business case, and how you met any pitch conditions.", where: "Dashboard", output: "Validated baseline + Blueprint {entry}" },
      { stage: 3, when: "Whole week", what: "Build, configure or trial. Use Tech Buddy office hours. Demo it working.", where: "Sandbox + Dashboard", output: "Build {entry} with a demo link or video" },
      { stage: 4, when: "Two weeks", what: "Go live with real users (or a controlled pilot). Track usage. Fix what breaks.", where: "Your department", output: "Adoption evidence" },
      { stage: 4, when: "Last 2 days", what: "Add the actual (after) numbers with period and evidence and submit them to an {auditor}. Submit the Live Run {entry}.", where: "Dashboard", output: "Actuals submitted + Live Run {entry}" },
      { stage: 5, when: "Finale", what: "Present the validated before/after and the value to TLE: 7-minute pitch + 3-minute Q&A. Hand over the sustainability plan.", where: "Grand Finale", output: "Final deck + sustainability plan" },
    ],
    dos: [
      "Start from a number that hurts today and that a system can report.",
      "Use what we already own first: many answers are unused features.",
      "Keep a human checkpoint wherever an agent acts on students, money or data.",
      "Attach evidence (report exports, query screenshots) every time you submit a number.",
    ],
    donts: [
      "Don't use personal AI accounts or copy student data out of our systems. Use the sanctioned sandbox.",
      "Don't change production configuration without the owner's approval and a rollback plan.",
      "Don't quote numbers that were not validated. The {jury} only sees validated ones.",
    ],
    faqs: [
      { q: "Do we have to use AI?", a: "No. A pure process fix is valid. Smart use of systems and agents earns credit under “AI & Tech Solution”, but value to TLE carries the most weight." },
      { q: "Can one person play several roles?", a: "Yes. Every role must be covered by someone; one person can cover several." },
      { q: "What if the {jury} says “Go with changes”?", a: "The agreed changes appear on your dashboard. Show how you met them in the Blueprint." },
      { q: "How is value calculated?", a: "Finance values validated results: realised ₹ during the live run plus the recurring ₹ per year (counted for up to 3 years), using fixed published rates." },
    ],
  },

  jury: {
    key: "jury",
    title: "Jury",
    who: "Leaders who score {entries} and decide at the gate",
    summary:
      "Decide which ideas go ahead after the Idea Pitch, then score each stage against the rubric. Value to TLE carries the most weight, and it must be validated.",
    steps: [
      { stage: 0, when: "Before launch", what: "Join the rubric briefing (30 min). Declare conflicts of interest: you don't score {crews} from your own team.", where: "Briefing call", output: "Conflicts recorded" },
      { stage: 1, when: "Friday", what: "Hear the Idea Pitches (5 min + Q&A). Score with the Idea Pitch rubric. As a panel, record Go, Go-with-changes (write the agreed changes) or Out.", where: "{jury} → Score → decision box", output: "Scores + a decision for every {crew}" },
      { stage: 2, when: "Within 48 h of the deadline", what: "Score the Blueprint. Check the pitch conditions were met and the baseline is validated.", where: "{jury} scoring", output: "Blueprint scores + feedback" },
      { stage: 3, when: "Within 48 h", what: "Score the Build: does the demo work, is it safe, will people use it?", where: "{jury} scoring", output: "Build scores" },
      { stage: 4, when: "Within 48 h", what: "Score the Live Run using adoption evidence and validated actuals.", where: "{jury} scoring", output: "Live Run scores" },
      { stage: 5, when: "Finale day", what: "Score the Reveal live. Agree the six category award winners as a panel.", where: "Live {jury} console", output: "Final scores + award picks" },
    ],
    dos: [
      "Score value on validated numbers only (shown in the scoring window).",
      "Write one line of feedback per score; {crews} see it after results.",
      "Reward non-tech solutions that clearly work; tech is a means, not the goal.",
    ],
    donts: ["Don't score a {crew} you have a conflict with.", "Don't change a gate decision without telling the organisers."],
    faqs: [
      { q: "What does “Go with changes” mean?", a: "The idea goes ahead only with the changes you write down. They are shown to the {crew} and to the {jury} in every later stage." },
      { q: "How are points calculated?", a: "Each stage has its own rubric. Scores are averaged across the {jury}, then scaled to the stage points (10 / 15 / 15 / 20 / 40)." },
    ],
  },

  auditor: {
    key: "auditor",
    title: "Auditors",
    who: "Data/BI team (validate numbers) and Finance (value them)",
    summary:
      "Nothing counts unless an {auditor} validates it. Data {auditors} check baselines and actuals against source systems; Finance {auditors} turn validated results into ₹ with fixed rates.",
    steps: [
      { stage: 0, when: "Before launch", what: "Finance: publish the conversion rates (₹/hour, ₹/lead, ₹/enrolment) and the recurring-value rule (annualised, max 3 years).", where: "Rules page / announcement", output: "Published rate card" },
      { stage: 2, when: "Within 48 h of each submission", what: "Data: validate baselines. Re-run the query or report and check the period and method. Validate, or send back with a note.", where: "{auditor} desk → Baselines", output: "Validated or returned baselines" },
      { stage: 4, when: "During the live run", what: "Data: spot-check that the live-run data source is the same one used for the baseline.", where: "Source systems", output: "Spot-check notes" },
      { stage: 4, when: "End of live run (48 h)", what: "Data: validate actuals the same way.", where: "{auditor} desk → Actuals", output: "Validated actuals" },
      { stage: 5, when: "Before the finale", what: "Finance: enter realised ₹ (live run) and recurring ₹/yr with the basis. Validate or send back.", where: "{auditor} desk → Valuation", output: "Value to TLE per metric" },
    ],
    dos: ["Check like-for-like: same source, same filter, comparable period.", "Write the basis for every ₹ figure."],
    donts: ["Don't validate a number without evidence.", "Don't value a result whose actual isn't validated."],
    faqs: [
      { q: "What if a {crew} edits a validated number?", a: "It automatically goes back to draft and needs validating again." },
      { q: "Who sees my notes?", a: "The {crew} sees your notes when you send something back." },
    ],
  },

  "tech-buddy": {
    key: "tech-buddy",
    title: "Tech Buddies",
    who: "Tech team members mentoring {crews}",
    summary: "Unblock, advise and review. You are a coach, not a builder: the {crew} does the work.",
    steps: [
      { stage: 1, when: "Week 1", what: "Run bootcamp labs. Get your {crews} into the sandbox. Sanity-check their problem is measurable.", where: "Bootcamp / office hours", output: "{crews} set up" },
      { stage: 2, when: "Week 2", what: "Review the system change spec / Agent Charter for feasibility, security and data access.", where: "{crew} dashboard (read-only)", output: "Review comments" },
      { stage: 3, when: "Twice a week", what: "Office hours: unblock configuration, APIs, prompts and n8n flows.", where: "Office hours", output: "Blockers cleared" },
      { stage: 4, when: "Live run", what: "Help with safe production rollout: maker-checker, rollback, monitoring.", where: "Change process", output: "Safe go-live" },
    ],
    dos: ["Point {crews} to features we already have.", "Flag security or DPDP risks early."],
    donts: ["Don't build the solution for the {crew}.", "Don't grant production access outside the normal process."],
    faqs: [{ q: "Can I also compete?", a: "No. You are either in a {crew} or a Tech Buddy, not both." }],
  },

  sponsor: {
    key: "sponsor",
    title: "Department heads & problem sponsors",
    who: "Owners of the problems in the Problem Bank",
    summary: "Put real problems on the table, open the doors for the {crews} and own the winning solutions afterwards.",
    steps: [
      { stage: 0, when: "Before launch", what: "Submit 1–3 problems as outcomes with today's number (X) and a target (Y). Name a contact.", where: "Organisers / Problem Bank", output: "Problems in the bank" },
      { stage: 1, when: "Week 1", what: "Nominate people for {crews} and free up ~4 hours a week for them.", where: "Your team", output: "Participation" },
      { stage: 2, when: "Week 2", what: "Give data access for the baseline and confirm the metric is the one you care about.", where: "Your systems", output: "Baseline data available" },
      { stage: 4, when: "Week 4", what: "Approve the live run in your area and make sure users try the new way.", where: "Your department", output: "Live run approved" },
      { stage: 5, when: "After the finale", what: "Commit to owning the solution (budget, owner, SLA) if it works.", where: "Handover", output: "Named owner" },
    ],
    dos: ["Pick problems that hurt and can be measured.", "Protect your people's contest time."],
    donts: ["Don't hand over problems you are not willing to change."],
    faqs: [{ q: "Can my problem be taken by two {crews}?", a: "Yes, up to the limit the organisers set. Two approaches often make a better winner." }],
  },

  organiser: {
    key: "organiser",
    title: "Organisers",
    who: "Contest admins",
    summary: "Run the calendar, keep the rules fair, and turn winners into real change.",
    steps: [
      { stage: 0, when: "Two weeks before", what: "Launch checklist: dates on every stage, Problem Bank filled, rate card from Finance, {auditors} and {jury} added, Sandbox Kit ready, prize budget approved.", where: "Admin → Settings / Ideathon Ops", output: "Contest set to Active" },
      { stage: 1, when: "Week 1", what: "Approve {crews}, watch the composition checklist, approve proposed problems, schedule the Idea Pitch.", where: "Admin → {crews} / Ideathon Ops", output: "{crews} approved" },
      { stage: 1, when: "Friday", what: "Make sure every {crew} gets a gate decision; announce the Go list.", where: "Ideathon Ops → decisions", output: "Go list published" },
      { stage: 2, when: "Weekly", what: "Chase the {auditor} queue (48 h target) and stage deadlines; post announcements.", where: "Ideathon Ops / Announcements", output: "No stuck items" },
      { stage: 5, when: "Finale", what: "Run the live finale, assign category awards, publish results, issue certificates.", where: "Live control / Admin", output: "Results + certificates" },
      { stage: 5, when: "After", what: "Pay out prizes. Hand winning solutions to owners. Keep the Agent Registry as the org inventory.", where: "Finance / owners", output: "Handover done" },
    ],
    dos: ["Publish the rate card before any value is claimed.", "Keep the Problem Bank outcome-based (“from X to Y”)."],
    donts: ["Don't let known system bugs into the bank; they belong in the tech backlog."],
    faqs: [{ q: "Can an Out {crew} come back?", a: "Only if the {jury} changes its decision. Recording Go again reinstates the {crew}." }],
  },
};

export function playbookRoleFor(role: string | null | undefined): StakeholderKey {
  switch (role) {
    case "judge":
      return "jury";
    case "validator":
      return "auditor";
    case "mentor":
      return "tech-buddy";
    case "admin":
      return "organiser";
    default:
      return "participant";
  }
}

export function fillTokens(text: string, t: (k: "team" | "judge" | "validator" | "phase" | "track" | "submission") => string): string {
  const plural = (w: string) => (/y$/i.test(w) && !/jury$/i.test(w) ? w.slice(0, -1) + "ies" : /jury$/i.test(w) ? w : w + "s");
  return text
    .replace(/\{crews\}/g, plural(t("team")))
    .replace(/\{crew\}/g, t("team"))
    .replace(/\{jury\}/g, t("judge"))
    .replace(/\{auditors\}/g, plural(t("validator")))
    .replace(/\{auditor\}/g, t("validator"))
    .replace(/\{stage\}/g, t("phase"))
    .replace(/\{lens\}/g, t("track"))
    .replace(/\{entries\}/g, plural(t("submission")))
    .replace(/\{entry\}/g, t("submission"));
}

/** The stage whose dates contain `now` (phaseConfig dates are yyyy-mm-dd), or null. */
export function currentStage(phases: Array<{ phase: number; startDate?: string; endDate?: string }>, now = new Date()): number | null {
  const day = now.toISOString().slice(0, 10);
  const hit = phases.find((p) => p.startDate && p.endDate && p.startDate <= day && day <= p.endDate);
  if (hit) return hit.phase;
  const first = phases.find((p) => p.startDate);
  if (first?.startDate && day < first.startDate) return 0;
  return null;
}
