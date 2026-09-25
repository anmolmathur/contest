/**
 * Demo contest for explaining the Ideathon format (fictional data only).
 *
 *   DATABASE_URL=... SEED_PASSWORD=... npx tsx scripts/seed-aideathon-demo.ts [--state=final|live|pitch] [--reset]
 *
 * Rebuilds "TLE AIdeathon 2026 (Demo)" (slug tle-aideathon-2026-demo) from
 * the Ideathon preset every run, so running it twice gives the same result.
 * --reset is accepted for symmetry with seed-test-contests.ts (same effect).
 *
 *   --state=pitch  today is Idea Pitch Friday: entries in, some decisions made
 *   --state=live   today is mid live-run: baselines validated, first actuals in
 *   --state=final  (default) finale done: ranking, awards, value meter, results
 *
 * Stage dates are placed around today so the playbook's "this week" and the
 * dashboard's next action match the chosen state.
 *
 * Every person, crew and number is fictional; accounts use @example.com and
 * share SEED_PASSWORD. Demo logins (one per stakeholder view):
 *   demo.organiser@  demo.mastermind@  demo.participant@  demo.jury@
 *   demo.auditor.data@  demo.auditor.finance@  demo.buddy@   (…@example.com)
 */
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  announcements,
  contests,
  impactMetrics,
  problemStatements,
  scores,
  stageDecisions,
  submissions,
  teams,
  users,
} from "@/lib/db/schema";
import { createContestFromPreset } from "@/lib/contest-create";
import { getPreset } from "@/lib/contest-types";
import { criteriaForPhase } from "@/lib/scoring";
import { AIDEATHON_WORDMARK } from "@/lib/wordmark";
import type { AgentCharterEntry, SubmissionValues } from "@/lib/contest-config";
import { createSeedKit, makePdf } from "./seed-helpers";

const SLUG = "tle-aideathon-2026-demo";
const PASSWORD = process.env.SEED_PASSWORD;
const UPLOADS = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
const STATE = ((process.argv.find((a) => a.startsWith("--state="))?.split("=")[1] ?? "final") as "pitch" | "live" | "final");

if (!PASSWORD || PASSWORD.length < 8) {
  console.error("Set SEED_PASSWORD (min 8 chars) — it becomes the password of every demo account.");
  process.exit(1);
}
if (!["pitch", "live", "final"].includes(STATE)) {
  console.error("--state must be pitch, live or final");
  process.exit(1);
}

const { saveUpload, upsertUser, enrol } = createSeedKit({ password: PASSWORD, uploadsDir: UPLOADS });

// ---------------------------------------------------------------------------
// Calendar: stage 1 = week 1 … stage 5 = week 6, placed around today
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
// Days since launch (Monday of week 1) for each state.
const OFFSET = { pitch: 4, live: 24, final: 45 }[STATE];
const S = new Date(today.getTime() - OFFSET * DAY);
const d = (n: number) => new Date(S.getTime() + n * DAY);
const iso = (n: number) => d(n).toISOString().slice(0, 10);
const nice = (n: number) => d(n).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const STAGE_DAYS: Record<number, [number, number]> = { 1: [0, 4], 2: [7, 11], 3: [14, 18], 4: [21, 32], 5: [35, 39] };
const BASELINE_PERIOD = `${d(-35).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${d(-6).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
const LIVE_PERIOD = `${nice(21)} – ${nice(32)}`;

/** Stages that have finished (or are being judged) in this state. */
const DONE_STAGES = { pitch: [1], live: [1, 2, 3], final: [1, 2, 3, 4, 5] }[STATE];

// ---------------------------------------------------------------------------
// Deterministic "randomness"
// ---------------------------------------------------------------------------
let rng = 2026;
const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const R = {
  MM: "The Mastermind",
  IN: "The Insider",
  BW: "The Bot Whisperer",
  SH: "The Systems Hacker",
  DM: "The Deal Maker",
  NK: "The Numbers Keeper",
  CP: "The Crowd Puller",
  SD: "The Shield",
};

interface Member {
  email?: string;
  name: string;
  dept: string;
  roles: string[];
}

interface MetricDef {
  name: string;
  unit: string;
  direction: "increase" | "decrease";
  category: string;
  source: string;
  method: string;
  baseline: number;
  target: number;
  actual: number;
  realised: number;
  recurring: number;
  years: number;
  basis: string;
}

interface CrewDef {
  name: string;
  problem: string; // problem title (bank or proposal)
  paths: string[];
  members: Member[];
  mentor?: string; // tech buddy email
  decision: "go" | "conditional" | "out";
  conditions?: string;
  /** Quality per stage on the 1–10 scale (drives jury scores). */
  quality: number[];
  canvas: string;
  idea: string;
  value: string;
  design: string;
  systemChange?: string;
  charter?: AgentCharterEntry[];
  build: string;
  adoption: string;
  sustain: string;
  metrics: MetricDef[];
  proposal?: { status: "approved" | "rejected"; description: string; track: string; note?: string };
}

const CREWS: CrewDef[] = [
  {
    name: "Ring Masters",
    problem: "Reduce RNR (ring-no-response) at a university",
    paths: ["Process Re-engineering", "Tool Purchase"],
    decision: "conditional",
    conditions:
      "Pilot on one university only. Legal must approve the call-consent script before any automated dialling. Show the vendor's data-residency terms in the Blueprint.",
    quality: [8, 8, 8, 9, 9],
    mentor: "demo.buddy@example.com",
    members: [
      { email: "demo.mastermind@example.com", name: "Aditi Sharma", dept: "Admissions & Counselling", roles: [R.MM, R.CP] },
      { name: "Kunal Bose", dept: "Admissions & Counselling", roles: [R.IN] },
      { name: "Farhan Qureshi", dept: "Technology", roles: [R.SH, R.BW] },
      { name: "Pooja Nair", dept: "Finance", roles: [R.DM, R.NK] },
      { name: "Siddharth Rao", dept: "Legal & Compliance", roles: [R.SD] },
    ],
    canvas:
      "68% of first calls to University Z leads go unanswered (Aug, CRM call logs). Counsellors redial blindly at the same times; leads go cold in 48 hours. Today: 68% RNR. Target: 50%.",
    idea:
      "Call when students actually pick up: use last-answered-time patterns, send a WhatsApp heads-up 10 minutes before the call, and trial a predictive dialler that stops on connect. Counsellors only talk; the dialler does the chasing.",
    value:
      "Every 1 pt of RNR ≈ 2 more enrolments/month at Univ Z. 18 pts ≈ 36 enrolments/month × ₹14,000 TLE share ≈ ₹60L/yr recurring. Tool cost ≈ ₹4.8L/yr.",
    design:
      "New flow: lead scored → WhatsApp heads-up (approved template) → dialler calls in the student's best window → counsellor picks up only connected calls → CRM disposition auto-filled. Human checkpoint: counsellor confirms disposition; supervisor reviews daily RNR by slot.",
    build:
      "Dialler trial connected to the CRM sandbox with click-to-call; WhatsApp heads-up template approved; best-call-window report built on Snowflake. Demo shows 20 live calls with stop-on-connect.",
    adoption:
      "18 of 22 Univ Z counsellors used the new flow on 3,140 calls over 12 days. RNR 49% vs 68% baseline. Two counsellors opted out on day 1 and back by day 3 after slot tuning.",
    sustain:
      "Admissions ops owns the dialler (named owner: Univ Z cluster head). Monthly cost ₹40k. Weekly RNR-by-slot review. Rollout to 3 more universities if RNR stays < 52% for 4 weeks.",
    metrics: [
      {
        name: "RNR rate — University Z",
        unit: "%",
        direction: "decrease",
        category: "revenue",
        source: "CRM call logs (Snowflake)",
        method: "First-attempt counselling calls with no answer ÷ all first attempts, Univ Z leads",
        baseline: 68,
        target: 50,
        actual: 49,
        realised: 640000,
        recurring: 4200000,
        years: 2,
        basis: "−19 pts RNR → +30 enrolments/month × ₹14,000 TLE share; realised = 12-day live run; net of ₹4.8L/yr tool cost",
      },
      {
        name: "Enrolments from Univ Z leads per week",
        unit: "enrolments",
        direction: "increase",
        category: "revenue",
        source: "UMS admissions",
        method: "Weekly paid enrolments where lead source university = Univ Z",
        baseline: 21,
        target: 26,
        actual: 28,
        realised: 0,
        recurring: 0,
        years: 0,
        basis: "Already valued in the RNR metric (no double counting)",
      },
    ],
  },
  {
    name: "Fast Lane",
    problem: "Cut student admission TAT",
    paths: ["Process Re-engineering", "System Change", "Agent Build"],
    decision: "go",
    quality: [9, 9, 8, 8, 8.6],
    mentor: "buddy2@example.com",
    members: [
      { name: "Meera Iyer", dept: "University Operations", roles: [R.MM] },
      { email: "demo.participant@example.com", name: "Rohan Kapoor", dept: "University Operations", roles: [R.IN, R.NK, R.SD] },
      { name: "Tanvi Deshpande", dept: "Technology", roles: [R.BW] },
      { name: "Imran Sheikh", dept: "Product", roles: [R.SH] },
      { name: "Neha Gupta", dept: "Finance", roles: [R.DM] },
      { name: "Arjun Pillai", dept: "Admissions & Counselling", roles: [R.CP] },
    ],
    canvas:
      "Application → admission confirmed takes 9.2 days on average (Aug, UMS). Documents bounce 3 times; ops re-checks eligibility by hand. Students drop out while waiting.",
    idea:
      "One-pass document check: an agent pre-checks uploaded documents against the programme's eligibility rules and flags gaps to the student the same day; ops only reviews flagged files. Turn on UMS auto-reminders that already exist but are switched off.",
    value:
      "5 days faster × ~1,150 admissions/month ≈ 2 FTE of ops time (₹6L/yr) + ~30 more admissions retained a year (₹12L). One-time build ≈ ₹50k.",
    design:
      "Doc Checker agent (L3) reads the upload, compares against the eligibility rules table, writes a checklist into UMS. Ops executive approves every flagged file (no auto-reject). UMS reminder rules re-enabled for missing documents at day 1 and day 3.",
    systemChange:
      "UMS: enable 'Pending documents' reminder workflow (exists, disabled since 2025); add eligibility-rules table per programme; expose read-only API for the agent. Rollback: toggle off the workflow.",
    charter: [
      {
        name: "Doc Checker",
        platform: "OpenWebUI + n8n",
        task: "Reads each uploaded document, checks it against the programme's eligibility rules, writes a checklist of gaps into UMS and drafts the message to the student.",
        autonomy: "L3",
        humanCheckpoint: "Ops executive approves every flagged file and every student message",
        dataAccessed: "Application documents (PII masked in logs), eligibility rules table",
        guardrails: "Never rejects on its own; confidence < 0.8 goes to a human; all runs traced in Langfuse",
        monthlyCostInr: 6500,
      },
    ],
    build:
      "Doc Checker running on the sandbox against 400 historical applications (92% agreement with ops). UMS reminder workflow re-enabled in staging; eligibility table filled for 38 programmes.",
    adoption:
      "Live for 2 universities: 1,030 applications processed, 71% passed first time (was 38%). Ops reviewed 299 flagged files; zero wrong rejections.",
    sustain:
      "Owner: University Ops lead. Running cost ₹6.5k/month. Eligibility table maintained by programme managers each intake. Next: 5 more universities in January.",
    metrics: [
      {
        name: "Admission TAT",
        unit: "days",
        direction: "decrease",
        category: "time",
        source: "UMS application log",
        method: "Average days from application submitted to admission confirmed, both pilot universities",
        baseline: 9.2,
        target: 5,
        actual: 4.1,
        realised: 320000,
        recurring: 1800000,
        years: 2,
        basis: "2 FTE ops time released (₹6L/yr) + 30 admissions/yr retained × ₹40,000 margin",
      },
    ],
  },
  {
    name: "Exam Autopilot",
    problem: "Cut pre-exam setup time",
    paths: ["System Change", "Agent Build"],
    decision: "go",
    quality: [8, 8, 9, 8, 8.2],
    mentor: "buddy3@example.com",
    members: [
      { name: "Lakshmi Menon", dept: "Examinations", roles: [R.MM, R.IN] },
      { name: "Varun Chawla", dept: "Technology", roles: [R.BW, R.SH] },
      { name: "Sana Mirza", dept: "Examinations", roles: [R.NK, R.CP] },
      { name: "Deepak Yadav", dept: "Finance", roles: [R.DM] },
      { name: "Harini Subramaniam", dept: "Legal & Compliance", roles: [R.SD] },
    ],
    canvas:
      "Setting up one exam takes ~12 hours: copying the date sheet, question-bank mapping, proctoring settings, candidate lists. Config errors cause re-exams.",
    idea:
      "Setup Scout builds the exam configuration from the university's date sheet and flags anything unusual; a checklist agent verifies settings before publish.",
    value: "8+ hours × 26 exams/month × ₹450/hour + fewer re-exams ≈ ₹26L/yr.",
    design:
      "Date sheet (Excel/PDF) → Setup Scout drafts the exam config → coordinator reviews a diff view → Checklist Buddy verifies 40 settings → publish. Humans approve before publish.",
    systemChange: "Exam Central: import endpoint for draft configs; publish stays manual. Rollback: disable import.",
    charter: [
      {
        name: "Setup Scout",
        platform: "n8n + Claude",
        task: "Reads the date sheet and builds the draft exam configuration (dates, papers, question-bank mapping, candidate lists).",
        autonomy: "L3",
        humanCheckpoint: "Exam coordinator approves the diff before anything is published",
        dataAccessed: "Date sheets, question-bank metadata (no questions), candidate IDs",
        guardrails: "Can only create drafts; publish is human-only; runs logged",
        monthlyCostInr: 4000,
      },
      {
        name: "Checklist Buddy",
        platform: "OpenWebUI",
        task: "Checks 40 configuration settings against the university's rules and lists anything off.",
        autonomy: "L1",
        humanCheckpoint: "Coordinator reads the checklist; the agent changes nothing",
        dataAccessed: "Exam configuration (read-only)",
        guardrails: "Read-only access",
        monthlyCostInr: 800,
      },
    ],
    build: "Setup Scout produced drafts for 14 past exams; coordinators accepted 12 with minor edits. Checklist Buddy caught 3 real misconfigurations.",
    adoption: "Used for 19 live exams across 4 universities in the live run. Average setup 3.5 h. Zero config-related re-exams.",
    sustain: "Owner: Exams lead. ₹4.8k/month. Coordinators trained; SOP updated.",
    metrics: [
      {
        name: "Setup time per exam",
        unit: "hours",
        direction: "decrease",
        category: "time",
        source: "Exam Central audit log + coordinator timesheets",
        method: "Median hours from date sheet received to exam published",
        baseline: 12,
        target: 4,
        actual: 3.5,
        realised: 210000,
        recurring: 2600000,
        years: 3,
        basis: "8.5 h × 26 exams/month × ₹450/h + avoided re-exam cost (₹1.4L/month, 3-month average)",
      },
    ],
  },
  {
    name: "Close Encounters",
    problem: "Faster monthly MIS close",
    paths: ["Agent Build", "System Change"],
    decision: "go",
    quality: [7, 8, 8, 8, 7.8],
    members: [
      { name: "Ritu Agarwal", dept: "Finance", roles: [R.MM, R.IN] },
      { name: "Nikhil Bansal", dept: "Finance", roles: [R.NK, R.DM] },
      { name: "Ayesha Khan", dept: "Technology", roles: [R.BW, R.SH] },
      { name: "Prakash Hegde", dept: "HR & People", roles: [R.CP, R.SD] },
    ],
    canvas: "Monthly MIS takes 9 working days after month-end: trial balance mapping in Excel, cost allocations by hand, variance notes written from scratch.",
    idea: "An agent maps the trial balance to MIS heads using last month's mapping; a second drafts variance explanations for finance to edit.",
    value: "6 days × 2 finance staff × ₹5,000/day × 12 months ≈ ₹7.2L/yr, plus decisions 6 days earlier.",
    design: "TB upload → TB Mapper proposes mappings (confidence shown) → analyst approves → allocation rules run in Snowflake → Variance Explainer drafts notes → controller signs off.",
    systemChange: "Snowflake: allocation rules as a versioned table instead of Excel formulas.",
    charter: [
      {
        name: "TB Mapper",
        platform: "Claude",
        task: "Maps trial-balance lines to MIS heads based on history and flags new ledgers.",
        autonomy: "L2",
        humanCheckpoint: "Analyst approves every mapping change",
        dataAccessed: "Trial balance (masked warehouse copy)",
        guardrails: "Suggest-only; no write access to the ledger",
        monthlyCostInr: 2500,
      },
      {
        name: "Variance Explainer",
        platform: "Claude",
        task: "Drafts variance notes for lines that moved more than 10% vs plan.",
        autonomy: "L2",
        humanCheckpoint: "Finance controller edits and signs off every note",
        dataAccessed: "MIS output, plan",
        guardrails: "Drafts only",
        monthlyCostInr: 1500,
      },
    ],
    build: "Both agents ran on the last 3 closes in parallel with the manual process; mapping accuracy 96%.",
    adoption: "Used for the live month-end close; MIS pack delivered on working day 3.",
    sustain: "Owner: Finance controller. ₹4k/month. Mapping reviewed quarterly.",
    metrics: [
      {
        name: "MIS close time",
        unit: "days",
        direction: "decrease",
        category: "time",
        source: "Finance close calendar",
        method: "Working days from month-end to MIS pack sent",
        baseline: 9,
        target: 4,
        actual: 3,
        realised: 60000,
        recurring: 720000,
        years: 3,
        basis: "6 days × 2 FTE × ₹5,000/day × 12",
      },
    ],
  },
  {
    name: "Smart View Squad",
    problem: "Adopt the CRM features we already have",
    paths: ["Process Re-engineering"],
    decision: "go",
    quality: [7, 7, 7, 8, 7.6],
    members: [
      { name: "Gaurav Malhotra", dept: "Admissions & Counselling", roles: [R.MM, R.CP] },
      { name: "Shreya Kulkarni", dept: "Admissions & Counselling", roles: [R.IN] },
      { name: "Abhishek Tiwari", dept: "Product", roles: [R.SH, R.BW] },
      { name: "Kavita Joshi", dept: "HR & People", roles: [R.NK, R.DM, R.SD] },
    ],
    canvas: "Only 22% of counsellors use Smart Views and the follow-up dashboard. The rest work from Excel exports, so follow-ups are missed.",
    idea: "No new tech: 3 ready-made Smart Views per role, a 15-minute daily huddle run from the dashboard, and managers review follow-ups only in CRM.",
    value: "Follow-up misses down a third → 1.5 h/counsellor/week saved and fewer cold leads ≈ ₹9L/yr.",
    design: "Role-based Smart Views configured by product; huddle script; manager scorecard from the existing dashboard. Excel exports switched off for counsellors after week 2 (manager approval).",
    build: "Views configured for 3 roles; huddle run in 4 teams; export restriction scheduled.",
    adoption: "61% weekly active Smart View users (from 22%). Follow-up SLA misses down 31%.",
    sustain: "Cluster heads own the huddle; scorecard in the monthly review.",
    metrics: [
      {
        name: "Counsellors using Smart Views weekly",
        unit: "%",
        direction: "increase",
        category: "adoption",
        source: "CRM usage log",
        method: "Counsellors with ≥3 Smart View sessions in the week ÷ active counsellors",
        baseline: 22,
        target: 55,
        actual: 61,
        realised: 90000,
        recurring: 900000,
        years: 2,
        basis: "1.5 h/week × 60 counsellors × ₹300/h, plus retained leads (conservative)",
      },
    ],
  },
  {
    name: "Consent Keepers",
    problem: "DPDP consent coverage",
    paths: ["System Change", "Agent Build"],
    decision: "go",
    quality: [7, 7, 7, 7, 7.3],
    members: [
      { name: "Anjali Verma", dept: "Legal & Compliance", roles: [R.MM, R.SD] },
      { name: "Sameer Joshi", dept: "Technology", roles: [R.SH, R.BW] },
      { name: "Ira Chatterjee", dept: "Marketing", roles: [R.IN, R.CP] },
      { name: "Manish Goel", dept: "Finance", roles: [R.DM, R.NK] },
    ],
    canvas: "Only 2 of 5 student-facing systems capture and log consent the DPDP way.",
    idea: "Plug the existing consent registry into the remaining 3 systems; an audit agent checks daily that every new record has a consent entry.",
    value: "Risk avoidance: remediation cost estimate by Legal (conservative) ≈ ₹5L/yr.",
    design: "Consent API calls added to 3 forms; Consent Auditor (L1) compares new records vs consent log and reports gaps.",
    systemChange: "Digivarsity, Partner portal and LMS sign-up forms call the consent registry API.",
    charter: [
      {
        name: "Consent Auditor",
        platform: "n8n",
        task: "Daily check that every new student record in 5 systems has a matching consent entry; emails a gap report.",
        autonomy: "L1",
        humanCheckpoint: "Compliance officer reviews the gap report daily",
        dataAccessed: "Record IDs and consent IDs only (no personal data)",
        guardrails: "Read-only, IDs only",
        monthlyCostInr: 500,
      },
    ],
    build: "Consent calls live in staging for all 3 systems; auditor runs nightly.",
    adoption: "All 5 systems logging consent in production; daily gaps down from 2,300 to 0 by day 9.",
    sustain: "Owner: DPO. Gap report part of the weekly compliance review.",
    metrics: [
      {
        name: "Student-facing systems logging consent",
        unit: "%",
        direction: "increase",
        category: "risk",
        source: "Consent registry + system inventory",
        method: "Systems with consent captured and logged for 100% of new records ÷ student-facing systems",
        baseline: 40,
        target: 100,
        actual: 100,
        realised: 0,
        recurring: 500000,
        years: 3,
        basis: "Legal's conservative estimate of avoided remediation effort",
      },
    ],
  },
  {
    name: "Pay Day",
    problem: "Cut payment drop-off at fee payment",
    paths: ["Tool Purchase", "System Change"],
    decision: "conditional",
    conditions: "Trial in the sandbox only until Tech's security review is done. No card data may touch our servers.",
    quality: [7, 6, 7, 7, 7],
    members: [
      { name: "Vivek Saxena", dept: "Finance", roles: [R.MM, R.DM] },
      { name: "Nisha Reddy", dept: "Student Success", roles: [R.IN, R.CP] },
      { name: "Aman Arora", dept: "Technology", roles: [R.SH, R.BW, R.SD] },
      { name: "Zoya Hussain", dept: "University Operations", roles: [R.NK] },
    ],
    canvas: "41% of students who reach the fee-payment step don't pay. Top reasons: failed UPI, no EMI option, session timeout.",
    idea: "Trial a payment-orchestration tool with automatic retry across gateways and a no-cost EMI option; add a one-tap pay link by WhatsApp.",
    value: "11 pts less drop-off on ~2,400 attempts/month × average first instalment × TLE share ≈ ₹31L/yr, net of tool cost.",
    design: "Checkout routed through the trial tool (hosted page, no card data on our side); failed attempts retried on a second gateway; pay link sent after 30 minutes of inactivity.",
    systemChange: "UMS payment page points to the hosted checkout for the pilot university; webhook updates payment status.",
    build: "Sandbox integration done; security review passed with 2 fixes; hosted checkout live for one university.",
    adoption: "1,180 payment attempts in the live run; drop-off 30%.",
    sustain: "Owner: Finance ops. Contract decision after 90 days; tool cost ₹4.8L/yr.",
    metrics: [
      {
        name: "Payment drop-off",
        unit: "%",
        direction: "decrease",
        category: "revenue",
        source: "Payment gateway reports + UMS",
        method: "Students reaching payment step who did not pay within 24 h ÷ all reaching the step",
        baseline: 41,
        target: 30,
        actual: 30,
        realised: 450000,
        recurring: 3100000,
        years: 2,
        basis: "Extra first payments captured × TLE share, net of ₹4.8L/yr tool cost",
      },
    ],
  },
  {
    name: "Stay Tuned",
    problem: "Reduce LMS student drop-off",
    paths: ["Process Re-engineering", "Agent Build"],
    decision: "go",
    quality: [7, 6, 6, 6, 6.6],
    members: [
      { name: "Pallavi Sinha", dept: "Student Success", roles: [R.MM, R.CP] },
      { name: "Rahul Bhatt", dept: "Academics & Content", roles: [R.IN] },
      { name: "Kiran Shetty", dept: "Technology", roles: [R.BW, R.SH] },
      { name: "Divya Prasad", dept: "Student Success", roles: [R.NK, R.DM, R.SD] },
    ],
    canvas: "62% of students at University Z stop logging in to the LMS within 6 weeks.",
    idea: "Weekly study-plan nudges on WhatsApp from an agent, plus a call from student success after 7 days of no login.",
    value: "11 pts less drop-off → more year-2 renewals ≈ ₹14L/yr.",
    design: "Nudge Bot sends approved templates based on LMS activity; escalations go to a student success executive.",
    charter: [
      {
        name: "Nudge Bot",
        platform: "n8n + WhatsApp templates",
        task: "Sends personalised study-plan reminders based on LMS activity; escalates inactive students to a human.",
        autonomy: "L3",
        humanCheckpoint: "Student success executive handles every escalation; templates pre-approved",
        dataAccessed: "LMS activity (last login, completion), phone number via consent registry",
        guardrails: "Approved templates only; max 2 messages/week; opt-out honoured",
        monthlyCostInr: 3000,
      },
    ],
    build: "Bot live for one cohort; 6 templates approved.",
    adoption: "2,050 students nudged; 380 escalations handled.",
    sustain: "Owner: Student success head. ₹3k/month.",
    proposal: {
      status: "rejected",
      track: "Student & Customer Experience",
      description: "Build a new student mobile app.",
      note: "Too large for five weeks. Pick an outcome from the bank.",
    },
    metrics: [
      {
        name: "LMS drop-off — University Z",
        unit: "%",
        direction: "decrease",
        category: "experience",
        source: "LMS activity report",
        method: "Students with no login in the last 21 days ÷ enrolled students, cohort Z",
        baseline: 62,
        target: 50,
        actual: 51,
        realised: 150000,
        recurring: 1400000,
        years: 2,
        basis: "Renewal uplift × TLE share (Finance model v2)",
      },
    ],
  },
  {
    name: "Paper Trail",
    problem: "Cut document verification TAT",
    paths: ["Agent Build"],
    decision: "out",
    conditions: "Overlaps heavily with Fast Lane's approach on the same process. Encouraged to join Fast Lane's live run as users.",
    quality: [5],
    members: [
      { name: "Hemant Kumar", dept: "University Operations", roles: [R.MM, R.IN, R.CP] },
      { name: "Rashmi Pandey", dept: "Technology", roles: [R.BW, R.SH, R.SD] },
      { name: "Sunil Mathew", dept: "Finance", roles: [R.DM, R.NK] },
    ],
    canvas: "Verifying one student's documents takes about 40 minutes.",
    idea: "An agent reads documents and fills the verification form.",
    value: "Time saved in ops (not sized yet).",
    design: "",
    build: "",
    adoption: "",
    sustain: "",
    metrics: [],
  },
  {
    name: "Cost Cutters",
    problem: "Cut unused telephony numbers and licences",
    paths: ["Process Re-engineering"],
    decision: "out",
    conditions: "No baseline data owner identified and the clean-up is already in the tech backlog. Please bring it to the next edition with a baseline.",
    quality: [4],
    members: [
      { name: "Tarun Saini", dept: "Technology", roles: [R.MM, R.SH, R.BW] },
      { name: "Priyanka Das", dept: "Finance", roles: [R.DM, R.NK, R.IN] },
      { name: "Mohit Jain", dept: "Marketing", roles: [R.CP, R.SD] },
    ],
    canvas: "We pay for telephony numbers and licences nobody uses.",
    idea: "Audit and remove unused numbers every month.",
    value: "Not sized.",
    design: "",
    build: "",
    adoption: "",
    sustain: "",
    proposal: {
      status: "approved",
      track: "Cost Reduction",
      description: "Monthly audit of telephony numbers and SaaS licences with no activity in 30 days.",
    },
    metrics: [],
  },
];

const JURY = [
  { email: "demo.jury@example.com", name: "Vikram Sethi" },
  { email: "jury2@example.com", name: "Farah Siddiqui" },
  { email: "jury3@example.com", name: "Rajesh Menon" },
  { email: "jury4@example.com", name: "Lakshmi Narayan" },
];

const FEEDBACK: Record<number, string[]> = {
  1: [
    "Clear problem with a real number behind it. Keep the scope tight.",
    "Good idea; make sure the baseline comes from the system, not a survey.",
    "Value estimate is plausible. Show the maths to Finance early.",
  ],
  2: ["Blueprint is concrete and the human checkpoints are clear.", "Baseline validated — good. Rollback plan needs one more line."],
  3: ["Demo works end to end. Watch the edge cases you mentioned.", "Solid build; show one real failure and how it is handled."],
  4: ["Strong adoption evidence with real users.", "Numbers validated; adoption good, keep the owner engaged."],
  5: ["Compelling before/after, fully validated.", "Clear value, clear owner, clear next step."],
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function removeExisting() {
  const existing = await db.query.contests.findFirst({ where: eq(contests.slug, SLUG), columns: { id: true } });
  if (!existing) return;
  await db.delete(teams).where(eq(teams.contestId, existing.id));
  await db.delete(contests).where(eq(contests.id, existing.id));
}

async function main() {
  await removeExisting();

  const pa = await db.query.users.findFirst({ where: eq(users.globalRole, "platform_admin") });
  const organiser = await upsertUser("demo.organiser@example.com", "Nandini Rao", { department: "Technology" });
  const creator = pa ?? organiser;
  const preset = getPreset("ideathon");

  const phaseConfig = preset.phaseConfig.map((p) => ({
    ...p,
    startDate: iso(STAGE_DAYS[p.phase][0]),
    endDate: iso(STAGE_DAYS[p.phase][1]),
  }));

  const contest = await createContestFromPreset({
    type: "ideathon",
    name: "TLE AIdeathon 2026 (Demo)",
    slug: SLUG,
    createdBy: creator.id,
    overrides: {
      status: STATE === "final" ? "completed" : "active",
      heroTitle: "TLE AIdeathon 2026",
      heroSubtitle: "Pick a real problem. Fix it with people, process, systems and AI. Prove it with numbers.",
      description:
        "Cross-functional crews from across TeamLease EdTech fix real business problems and prove the before/after with validated numbers. DEMO — all data is fictional.",
      phaseConfig,
      brandingConfig: {
        wordmark: [
          { text: "TLE ", font: "sans", weight: 600, scale: 0.42, tone: "muted" },
          ...AIDEATHON_WORDMARK,
          { text: " 2026", font: "sans", weight: 600, scale: 0.42, tone: "muted" },
        ],
        metaTitle: "TLE AIdeathon 2026 (Demo)",
      },
      settings: {
        ...preset.settings,
        demoBanner: true,
        resultsPublished: STATE === "final",
        theme: "Technology as a business lever: revenue, cost, process, safeguard",
      },
      rulesContent: [
        "## How value is counted",
        "",
        "Only numbers validated by an Auditor count. Finance converts validated results to ₹ with this rate card:",
        "",
        "| Item | Rate |",
        "|---|---|",
        "| Loaded staff time | ₹450 / hour (ops), ₹300 / hour (counsellor), ₹5,000 / day (finance) |",
        "| Enrolment | ₹14,000 TLE share |",
        "| Recurring value | Annualised, counted for up to 3 years |",
        "",
        "Value to TLE = realised ₹ during the live run + recurring ₹ per year × years.",
      ].join("\n"),
      faqConfig: [
        { question: "Do we have to use AI?", answer: "No. Process-only solutions are welcome; value to TLE carries the most weight." },
        { question: "Can one person play several roles?", answer: "Yes. Every Heist role must be covered; one person can cover several." },
        { question: "What happens at the Idea Pitch?", answer: "The jury says Go, Go-with-changes (you agree the changes) or Out." },
        { question: "Who checks the numbers?", answer: "Data/BI Auditors validate baselines and actuals; Finance values them in ₹." },
      ],
      startDate: d(0),
      endDate: d(39),
      registrationDeadline: d(2),
    },
  });
  console.log(`created ${SLUG} (${STATE}) — launch ${nice(0)}, finale ${nice(39)}`);

  // ---- staff -------------------------------------------------------------
  await enrol(contest.id, organiser.id, "admin");
  const juryUsers = [];
  for (const j of JURY) {
    const u = await upsertUser(j.email, j.name, { department: "Leadership" });
    await enrol(contest.id, u.id, "judge");
    juryUsers.push(u);
  }
  const auditorData = await upsertUser("demo.auditor.data@example.com", "Karan Batra", { department: "Technology" });
  const auditorData2 = await upsertUser("auditor2@example.com", "Meenal Joshi", { department: "Technology" });
  const auditorFin = await upsertUser("demo.auditor.finance@example.com", "Suresh Pillai", { department: "Finance" });
  await enrol(contest.id, auditorData.id, "validator", "Data");
  await enrol(contest.id, auditorData2.id, "validator", "Data");
  await enrol(contest.id, auditorFin.id, "validator", "Finance");
  const buddies: Record<string, string> = {};
  for (const [email, name] of [
    ["demo.buddy@example.com", "Ankit Verma"],
    ["buddy2@example.com", "Sneha Kulkarni"],
    ["buddy3@example.com", "Rohit Das"],
  ]) {
    const u = await upsertUser(email, name, { department: "Technology" });
    buddies[email] = u.id;
  }

  // ---- problems ----------------------------------------------------------
  const trackRows = await db.query.tracks.findMany({ where: (t, { eq: e }) => e(t.contestId, contest.id) });
  const trackId = (name: string) => trackRows.find((t) => t.name === name)?.id ?? null;
  const bank = await db.query.problemStatements.findMany({ where: eq(problemStatements.contestId, contest.id) });

  // ---- crews -------------------------------------------------------------
  const criteria = preset.scoringCriteria;
  let personIdx = 0;
  const summary: Array<{ crew: string; total: number }> = [];

  for (const crew of CREWS) {
    const slugPart = crew.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const memberUsers = [];
    for (const m of crew.members) {
      const email = m.email ?? `crew.${slugPart}.${++personIdx}@example.com`;
      memberUsers.push({ ...m, user: await upsertUser(email, m.name, { department: m.dept }) });
    }
    const leader = memberUsers[0].user;
    const out = crew.decision === "out";
    // In the pitch state not every decision is in yet.
    const pendingAtPitch = ["Paper Trail", "Pay Day", "Stay Tuned"].includes(crew.name);
    const decided = STATE !== "pitch" || !pendingAtPitch;
    const eliminated = out && decided;

    // Problem: bank problem or the crew's own proposal.
    let problemId: string | null = null;
    let problemTrack: string | null = null;
    let proposalId: string | null = null;
    if (crew.proposal) {
      const [pr] = await db
        .insert(problemStatements)
        .values({
          contestId: contest.id,
          trackId: trackId(crew.proposal.track),
          title: crew.proposal.status === "approved" ? crew.problem : crew.proposal.description,
          description: crew.proposal.description + (crew.proposal.note ? `\n\nOrganisers: ${crew.proposal.note}` : ""),
          ownerDepartment: crew.members[0].dept,
          maxTeams: 1,
          status: crew.proposal.status,
          sortOrder: 1000,
          createdBy: leader.id,
        })
        .returning();
      if (crew.proposal.status === "approved") {
        problemId = pr.id;
        problemTrack = pr.trackId;
      }
      proposalId = pr.id; // proposedByTeamId is set once the team exists (below)
    }
    if (!problemId) {
      const p = bank.find((b) => b.title === crew.problem);
      if (!p) throw new Error(`Problem not found in bank: ${crew.problem}`);
      problemId = p.id;
      problemTrack = p.trackId;
    }

    const [team] = await db
      .insert(teams)
      .values({
        name: crew.name,
        contestId: contest.id,
        trackId: problemTrack,
        createdBy: leader.id,
        leaderId: leader.id,
        approved: true,
        problemId,
        solutionPaths: crew.paths,
        status: eliminated ? "eliminated" : "active",
      })
      .returning();
    if (proposalId) await db.update(problemStatements).set({ proposedByTeamId: team.id }).where(eq(problemStatements.id, proposalId));

    for (const m of memberUsers) {
      const [primary, ...extra] = m.roles;
      await enrol(contest.id, m.user.id, "participant", primary, team.id, extra.length ? extra : null);
    }
    if (crew.mentor) await enrol(contest.id, buddies[crew.mentor], "mentor", null, team.id);

    // ---- gate decision ----
    if (decided) {
      await db.insert(stageDecisions).values({
        contestId: contest.id,
        teamId: team.id,
        phase: 1,
        decision: crew.decision,
        conditions: crew.conditions ?? null,
        decidedBy: juryUsers[0].id,
        decidedAt: d(4),
      });
    }

    // ---- submissions + scores ----
    const stages = out ? [1] : DONE_STAGES;
    let total = 0;
    for (const stage of stages) {
      const values = await stageValues(crew, stage, slugPart);
      const [sub] = await db
        .insert(submissions)
        .values({ teamId: team.id, phase: stage, fields: values, submittedAt: d(STAGE_DAYS[stage][1]) })
        .returning();
      // Jury scores: the whole panel scores finished stages; at pitch time only some are in.
      const judgeCount = STATE === "pitch" ? (decided ? 4 : 2) : 4;
      const stageCriteria = criteriaForPhase(criteria, stage);
      const q = crew.quality[stage - 1] ?? crew.quality[crew.quality.length - 1];
      const jitter = [0, 1, -1, 0];
      let stageAvg = 0;
      for (let j = 0; j < judgeCount; j++) {
        const criteriaScores: Record<string, number> = {};
        for (const [ci, c] of stageCriteria.entries()) {
          const offset = ((ci + j + crew.name.length) % 3) - 1; // −1..+1 spread across criteria
          criteriaScores[c.key] = Math.max(1, Math.min(10, Math.round(q + jitter[j] * 0.6 + offset * 0.5 + (rand() - 0.5) * 0.4)));
        }
        const fb = FEEDBACK[stage] ?? FEEDBACK[1];
        await db.insert(scores).values({
          submissionId: sub.id,
          judgeId: juryUsers[j].id,
          criteriaScores,
          feedback: out ? crew.conditions ?? null : fb[(j + crew.name.length) % fb.length],
        });
        const w = stageCriteria.reduce((s, c) => s + c.weight, 0);
        stageAvg += stageCriteria.reduce((s, c) => s + ((criteriaScores[c.key] - 1) / 9) * 100 * c.weight, 0) / w / judgeCount;
      }
      total += (stageAvg / 100) * (phaseConfig.find((p) => p.phase === stage)?.maxPoints ?? 0);
    }
    summary.push({ crew: crew.name, total: Math.round(total * 10) / 10 });

    // ---- impact metrics ----
    for (const [mi, m] of crew.metrics.entries()) {
      await db.insert(impactMetrics).values(await metricRow(contest.id, team.id, crew, m, mi, slugPart, [auditorData.id, auditorData2.id], auditorFin.id));
    }
  }

  // ---- awards (final state only) -------------------------------------------
  if (STATE === "final") {
    const teamRows = await db.query.teams.findMany({ where: eq(teams.contestId, contest.id), columns: { id: true, name: true } });
    const idOf = (n: string) => teamRows.find((t) => t.name === n)?.id ?? null;
    const winners: Record<string, string> = {
      bigScore: "Ring Masters",
      bestBot: "Exam Autopilot",
      insideJob: "Smart View Squad",
      smartestDeal: "Pay Day",
      theShield: "Consent Keepers",
      bestCrew: "Fast Lane",
    };
    await db
      .update(contests)
      .set({ awards: (preset.awards ?? []).map((a) => ({ ...a, winnerTeamId: idOf(winners[a.key]) })) })
      .where(eq(contests.id, contest.id));
  }

  // ---- announcements -----------------------------------------------------
  const posts = [
    {
      title: "We're live: form your crews",
      body: "Welcome to TLE AIdeathon 2026 (demo). Form a crew of 3–10 from at least two departments, cover every Heist role, and claim a problem from the Problem Bank. Idea Pitch is on Friday.",
      at: d(0),
    },
  ];
  if (STATE !== "pitch") {
    posts.push({
      title: "Idea Pitch results: 8 crews go ahead",
      body: "Six crews got a Go, two a Go-with-changes (check your dashboard for the agreed changes) and two are out this time. Baselines must be validated by an Auditor before the Blueprint deadline.",
      at: d(5),
    });
  }
  if (STATE === "final") {
    posts.push({
      title: "Results are out",
      body: "Congratulations to Ring Masters, Fast Lane and Exam Autopilot, and to the six category-award winners. See the Results page for the validated value unlocked.",
      at: d(39),
    });
  }
  for (const p of posts) {
    await db.insert(announcements).values({
      contestId: contest.id,
      title: p.title,
      body: p.body,
      pinned: p === posts[posts.length - 1],
      createdBy: organiser.id,
      publishedAt: p.at,
    });
  }

  summary.sort((a, b) => b.total - a.total);
  console.log("\nstanding (approx. points):");
  for (const s of summary) console.log(`  ${s.total.toFixed(1).padStart(5)}  ${s.crew}`);
  console.log(`\nDemo logins (password = SEED_PASSWORD):
  organiser  demo.organiser@example.com
  mastermind demo.mastermind@example.com   (Ring Masters)
  participant demo.participant@example.com (Fast Lane, 3 roles)
  jury       demo.jury@example.com
  auditor    demo.auditor.data@example.com / demo.auditor.finance@example.com
  buddy      demo.buddy@example.com
Files in ${UPLOADS}.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Per-stage entry values
// ---------------------------------------------------------------------------

async function pdf(kind: string, title: string, pages: string[][]) {
  return saveUpload(kind, "pdf", makePdf(title, pages));
}

async function stageValues(crew: CrewDef, stage: number, slugPart: string): Promise<SubmissionValues> {
  const v: SubmissionValues = {};
  const demo = `https://example.com/demo/${slugPart}`;
  const charter = crew.charter ? JSON.stringify(crew.charter) : undefined;
  switch (stage) {
    case 1:
      v.problemCanvas = crew.canvas;
      v.solutionIdea = crew.idea;
      v.solutionPaths = crew.paths;
      v.expectedValue = crew.value;
      v.pitchDeck = await pdf("submission_file", `${crew.name} — Idea Pitch`, [
        [`${crew.name}`, "Idea Pitch", crew.problem],
        ["The problem", ...wrap(crew.canvas)],
        ["The idea", ...wrap(crew.idea)],
        ["Expected value", ...wrap(crew.value)],
        ["The crew", ...crew.members.map((m) => `${m.name} — ${m.roles.join(", ")} (${m.dept})`)],
      ]);
      break;
    case 2:
      v.solutionPaths = crew.paths;
      if (crew.conditions) v.conditionsResponse = `Agreed changes addressed: ${crew.conditions} — done, see Blueprint section 3.`;
      v.solutionDesign = crew.design;
      v.processMap = await pdf("submission_file", `${crew.name} — Process map`, [
        ["Before", ...wrap(crew.canvas)],
        ["After", ...wrap(crew.design)],
      ]);
      if (crew.systemChange) v.systemChangeSpec = crew.systemChange;
      if (charter) v.agentCharter = charter;
      if (crew.paths.includes("Tool Purchase")) {
        v.toolBusinessCase = await pdf("submission_file", `${crew.name} — Tool business case`, [
          ["Tool business case", "3 vendors compared on cost, security, DPDP", "Shortlisted vendor: trial in sandbox"],
          ["Payback", ...wrap(crew.value)],
        ]);
      }
      break;
    case 3:
      if (charter) v.agentCharter = charter;
      v.buildSummary = crew.build;
      v.demoUrl = demo;
      v.demoVideoUrl = `${demo}/video`;
      break;
    case 4:
      if (charter) v.agentCharter = charter;
      v.buildSummary = crew.build;
      v.demoUrl = demo;
      v.adoptionEvidence = crew.adoption;
      v.runLog = await pdf("submission_file", `${crew.name} — Live run log`, [["Live run log", LIVE_PERIOD, ...wrap(crew.adoption)]]);
      break;
    case 5:
      v.pitchDeck = await pdf("submission_file", `${crew.name} — The Reveal`, [
        [crew.name, "The Reveal"],
        ["Before → after", ...crew.metrics.map((m) => `${m.name}: ${m.baseline}${m.unit === "%" ? "%" : ` ${m.unit}`} -> ${m.actual}${m.unit === "%" ? "%" : ` ${m.unit}`}`)],
        ["Adoption", ...wrap(crew.adoption)],
        ["What happens next", ...wrap(crew.sustain)],
      ]);
      if (charter) v.agentCharter = charter;
      v.demoUrl = demo;
      v.demoVideoUrl = `${demo}/video`;
      v.adoptionEvidence = crew.adoption;
      v.sustainabilityPlan = crew.sustain;
      break;
  }
  return v;
}

function wrap(text: string, width = 80): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Metric rows per state
// ---------------------------------------------------------------------------

async function metricRow(
  contestId: string,
  teamId: string,
  crew: CrewDef,
  m: MetricDef,
  idx: number,
  slugPart: string,
  dataAuditors: string[],
  financeAuditor: string,
): Promise<typeof impactMetrics.$inferInsert> {
  const baselineEvidence = [
    await pdf("submission_file", `${crew.name} — baseline extract`, [
      [`${m.name} — baseline`, `Source: ${m.source}`, `Method: ${m.method}`, `Period: ${BASELINE_PERIOD}`, `Value: ${m.baseline} ${m.unit}`],
    ]),
  ];
  const row: typeof impactMetrics.$inferInsert = {
    contestId,
    teamId,
    name: m.name,
    unit: m.unit,
    direction: m.direction,
    category: m.category,
    sourceSystem: m.source,
    method: m.method,
    baselineValue: m.baseline,
    baselinePeriod: BASELINE_PERIOD,
    baselineEvidence,
    targetValue: m.target,
    sortOrder: idx,
  };
  const validator = dataAuditors[(slugPart.length + idx) % dataAuditors.length];

  if (STATE === "pitch") {
    // Early starters only.
    if (crew.name === "Ring Masters") return { ...row, baselineStatus: "submitted" };
    if (crew.name === "Fast Lane") return { ...row, baselineStatus: "draft" };
    return { ...row, baselineStatus: "draft", baselineEvidence: [] };
  }

  const baselineDone = { ...row, baselineStatus: "validated", baselineValidatorId: validator };
  const actualEvidence = [
    await pdf("submission_file", `${crew.name} — live-run extract`, [
      [`${m.name} — actual`, `Source: ${m.source}`, `Period: ${LIVE_PERIOD}`, `Value: ${m.actual} ${m.unit}`],
    ]),
  ];
  const withActual = { ...baselineDone, actualValue: m.actual, actualPeriod: LIVE_PERIOD, actualEvidence };
  const valued = {
    ...withActual,
    actualStatus: "validated",
    actualValidatorId: validator,
    realisedValueInr: m.realised,
    recurringAnnualValueInr: m.recurring,
    recurringYears: m.years,
    valuationBasis: m.basis,
    financeStatus: "validated",
    financeValidatorId: financeAuditor,
  };

  if (STATE === "live") {
    // Live run in progress: a few crews already have numbers in.
    if (crew.name === "Ring Masters") return valued;
    if (crew.name === "Fast Lane") return { ...withActual, actualStatus: "validated", actualValidatorId: validator, financeStatus: "pending" };
    if (crew.name === "Exam Autopilot") return { ...withActual, actualStatus: "submitted" };
    if (crew.name === "Close Encounters") return { ...withActual, actualStatus: "draft" };
    return baselineDone;
  }
  return valued;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
