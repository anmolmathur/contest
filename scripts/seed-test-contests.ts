/**
 * Seed sample contests for testing / demos (NOT for production data).
 *
 *   DATABASE_URL=... SEED_PASSWORD=... npx tsx scripts/seed-test-contests.ts [--reset]
 *
 * Creates (idempotently, by slug):
 *   1. business-symposium-2026  — Business Symposium, active, full sample:
 *      categories, agenda, speakers/jury, 8 teams, round 2–4 entries with
 *      generated PDF/XLSX files, 1–10 jury scores with feedback, finale queue.
 *   2. ai-hackathon-2026        — Hackathon (new preset), active, 12 problem
 *      statements with one-team-per-statement, 5 teams, 0–100 scores.
 *   3. campus-startup-pitch     — Business Symposium, draft (for trying the
 *      admin editors and the AI setup assistant).
 *
 * Test accounts use @example.com addresses and share SEED_PASSWORD.
 * --reset deletes ONLY the three contests above (and their teams) first.
 *
 * Generated files are written to UPLOADS_DIR (default ./uploads) and
 * referenced as /uploads/<key>, matching the local upload driver.
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { contests, scores, submissions, teams, tracks, users } from "@/lib/db/schema";
import { createContestFromPreset } from "@/lib/contest-create";
import { getPreset } from "@/lib/contest-types";
import type { AgendaItem, LiveState, Speaker } from "@/lib/contest-config";
import { legacyColumnsFrom } from "@/lib/submission-fields";
import { createSeedKit, makePdf } from "./seed-helpers";

const SLUGS = ["business-symposium-2026", "ai-hackathon-2026", "campus-startup-pitch"];
const RESET = process.argv.includes("--reset");
const PASSWORD = process.env.SEED_PASSWORD;
const UPLOADS = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

if (!PASSWORD || PASSWORD.length < 8) {
  console.error("Set SEED_PASSWORD (min 8 chars) — it becomes the password of every seeded test account.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let rngState = 42;
function rand(): number {
  // deterministic PRNG so re-seeding gives the same scores
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
}
const pickInt = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

async function financialModelXlsx(teamName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("3-Year Projection");
  ws.columns = [
    { header: "Line item (INR lakh)", key: "k", width: 28 },
    { header: "Year 1", key: "y1", width: 12 },
    { header: "Year 2", key: "y2", width: 12 },
    { header: "Year 3", key: "y3", width: 12 },
  ];
  const rev = [pickInt(12, 30), 0, 0];
  rev[1] = Math.round(rev[0] * (1.8 + rand()));
  rev[2] = Math.round(rev[1] * (1.6 + rand()));
  const cost = rev.map((r, i) => Math.round(r * (0.95 - i * 0.12)));
  ws.addRow({ k: `${teamName} — revenue`, y1: rev[0], y2: rev[1], y3: rev[2] });
  ws.addRow({ k: "Operating cost", y1: cost[0], y2: cost[1], y3: cost[2] });
  ws.addRow({ k: "EBITDA", y1: rev[0] - cost[0], y2: rev[1] - cost[1], y3: rev[2] - cost[2] });
  ws.addRow({ k: "Customers (000s)", y1: pickInt(2, 8), y2: pickInt(10, 25), y3: pickInt(30, 70) });
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const { saveUpload, upsertUser, enrol } = createSeedKit({ password: PASSWORD!, uploadsDir: UPLOADS });

function isoDay(d: string) {
  return new Date(`${d}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function reset() {
  const rows = await db.query.contests.findMany({ where: inArray(contests.slug, SLUGS), columns: { id: true, slug: true } });
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  // teams → contests has no ON DELETE CASCADE; submissions/scores cascade from teams.
  await db.delete(teams).where(inArray(teams.contestId, ids));
  await db.delete(contests).where(inArray(contests.id, ids));
  console.log(`reset: removed ${rows.map((r) => r.slug).join(", ")}`);
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const FIRST = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Ananya", "Vihaan", "Isha", "Arjun", "Sara", "Neel", "Tara", "Dev", "Riya", "Kiaan", "Anika", "Yash", "Myra", "Ishaan", "Zoya", "Aditya", "Kavya", "Reyansh", "Pari", "Vivaan", "Nisha", "Aryan", "Sanya", "Om", "Leela", "Advik", "Jiya"];
const LAST = ["Sharma", "Iyer", "Khan", "Nair", "Patel", "Das", "Menon", "Gupta", "Rao", "Kapoor", "Singh", "Bose", "Joshi", "Pillai", "Reddy", "Mehta"];

async function participants(prefix: string, count: number, college: string) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[(i * 7 + prefix.length) % FIRST.length];
    const last = LAST[(i * 5 + prefix.length) % LAST.length];
    out.push(
      await upsertUser(`${prefix}.student${String(i + 1).padStart(2, "0")}@example.com`, `${first} ${last}`, {
        department: college,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Business Symposium
// ---------------------------------------------------------------------------

async function seedSymposium(creatorId: string) {
  const slug = "business-symposium-2026";
  if (await db.query.contests.findFirst({ where: eq(contests.slug, slug) })) {
    console.log(`skip: ${slug} exists (use --reset to rebuild)`);
    return;
  }
  const preset = getPreset("business_symposium");

  const phases = preset.phaseConfig.map((p) => ({ ...p }));
  const dates: Array<[string, string]> = [
    ["2026-09-20", "2026-10-05"],
    ["2026-10-06", "2026-10-15"],
    ["2026-10-16", "2026-10-31"],
    ["2026-11-07", "2026-11-07"],
    ["2026-11-07", "2026-11-07"],
  ];
  phases.forEach((p, i) => {
    p.startDate = dates[i][0];
    p.endDate = dates[i][1];
  });

  const speakers: Speaker[] = [
    { id: "sp-1", name: "Radhika Varma", title: "Chief Strategy Officer", org: "Northwind Retail Group", bio: "25 years building consumer brands across India and South-East Asia.", roles: ["speaker", "jury"] },
    { id: "sp-2", name: "Farhan Qureshi", title: "Founder & CEO", org: "LedgerLeaf (FinTech)", bio: "Built a credit-for-MSMEs platform from zero to 2 lakh merchants.", roles: ["speaker", "panelist", "jury"] },
    { id: "sp-3", name: "Dr. Meenakshi Rao", title: "Professor of Strategy", org: "Institute of Management Studies", bio: "Researches platform business models and family businesses.", roles: ["panelist", "jury"] },
    { id: "sp-4", name: "Karan Malhotra", title: "Partner", org: "Banyan Seed Ventures", bio: "Early-stage investor in climate and education startups.", roles: ["panelist", "jury"] },
    { id: "sp-5", name: "Sunita Deshpande", title: "CHRO", org: "Aster Manufacturing", bio: "Leads people strategy for 40,000 employees; champion of apprenticeships.", roles: ["speaker", "panelist"] },
    { id: "sp-6", name: "Vikram Sethi", title: "Head of Sustainability", org: "Coastal Energy Ltd", bio: "Drives the company's net-zero roadmap and ESG reporting.", roles: ["speaker"] },
    { id: "sp-7", name: "Aisha Siddiqui", title: "Co-founder", org: "KiranaKart", bio: "Took a hyperlocal commerce idea from a campus competition to Series A.", roles: ["speaker"] },
    { id: "sp-8", name: "Rahul Bhatt", title: "Director, Campus Relations", org: "TeamLease EdTech", bio: "Hosts the symposium and connects students with recruiters.", roles: ["host", "mentor"] },
  ];

  const agenda: AgendaItem[] = [
    { id: "ag-1", day: "2026-11-06", start: "09:30", end: "10:00", title: "Welcome & Inaugural Address", kind: "ceremony", speakerIds: ["sp-8"], venue: "Main Auditorium" },
    { id: "ag-2", day: "2026-11-06", start: "10:00", end: "10:45", title: "Keynote: Building Businesses for a Sustainable, Digital and Inclusive Future", kind: "keynote", speakerIds: ["sp-1"], venue: "Main Auditorium" },
    { id: "ag-3", day: "2026-11-06", start: "11:00", end: "12:00", title: "Panel: What Recruiters and Investors Look For in Young Leaders", kind: "panel", speakerIds: ["sp-2", "sp-3", "sp-4", "sp-5"], venue: "Main Auditorium" },
    { id: "ag-4", day: "2026-11-06", start: "12:00", end: "12:40", title: "Industry Expert Session: ESG Is a Business Strategy", kind: "expert_session", speakerIds: ["sp-6"], venue: "Hall B" },
    { id: "ag-5", day: "2026-11-06", start: "12:40", end: "13:30", title: "Lunch & Innovation Showcase opens", kind: "break", venue: "Exhibition Lawn" },
    { id: "ag-6", day: "2026-11-06", start: "13:30", end: "14:15", title: "Startup Success Story: From Campus Competition to Series A", kind: "startup_story", speakerIds: ["sp-7"], venue: "Main Auditorium" },
    { id: "ag-7", day: "2026-11-06", start: "14:30", end: "16:00", title: "Future Skills Workshop: Pitching with Data", kind: "workshop", speakerIds: ["sp-2"], venue: "Hall B", description: "Hands-on: turning market research into a 3-slide investor story." },
    { id: "ag-8", day: "2026-11-07", start: "09:30", end: "13:00", title: "Grand Finale — Live Pitches to the Industry Jury", kind: "pitch", speakerIds: ["sp-1", "sp-2", "sp-3", "sp-4"], venue: "Main Auditorium", description: "7-minute pitch + 3-minute Q&A per team." },
    { id: "ag-9", day: "2026-11-07", start: "13:00", end: "14:30", title: "Networking & Industry Connect", kind: "networking", venue: "Exhibition Lawn", description: "Students meet recruiters, founders, investors and faculty." },
    { id: "ag-10", day: "2026-11-07", start: "15:00", end: "16:00", title: "Results & Awards Ceremony", kind: "ceremony", speakerIds: ["sp-8", "sp-1"], venue: "Main Auditorium" },
  ];

  const contest = await createContestFromPreset({
    type: "business_symposium",
    name: "Business Symposium 2026",
    slug,
    createdBy: creatorId,
    overrides: {
      status: "active",
      heroTitle: "Business Symposium 2026",
      heroSubtitle: "Innovating for a Sustainable, Digital, and Inclusive Future",
      description:
        "A flagship academic and industry engagement event where student teams apply business knowledge, analytical thinking and entrepreneurial skills to real-world business challenges — and pitch to an industry jury.",
      rulesContent:
        "Teams solve an industry-defined challenge in their chosen category across three rounds: concept note screening, business plan with mentor review, and a live Grand Finale pitch. Original work only; cite all data sources. Late submissions are not accepted.",
      phaseConfig: phases,
      agenda,
      speakers,
      faqConfig: [
        { question: "Can students from different colleges form one team?", answer: "Yes. Inter-college and inter-disciplinary teams of 3–5 are welcome." },
        { question: "Do we need a working prototype?", answer: "No. This is a business challenge — a clear business case, research and financial model matter most. A mock-up link is optional." },
        { question: "How long is the finale pitch?", answer: "7 minutes of pitch followed by 3 minutes of jury Q&A." },
        { question: "Will we get feedback?", answer: "Yes. Jury feedback for each round is shared with your team once results are published." },
      ],
      prizes: [
        { rank: 1, label: "Winner", amount: 100000, color: "gold" },
        { rank: 2, label: "1st Runner-up", amount: 50000, color: "silver" },
        { rank: 3, label: "2nd Runner-up", amount: 25000, color: "bronze" },
      ],
      startDate: isoDay("2026-09-20"),
      endDate: isoDay("2026-11-07"),
      registrationDeadline: isoDay("2026-10-20"),
      supportEmail: "symposium-help@example.com",
    },
  });

  const cats = await db.query.tracks.findMany({ where: eq(tracks.contestId, contest.id) });
  const cat = (name: string) => cats.find((c) => c.name.startsWith(name))!.id;

  // People
  const admin = await upsertUser("symposium.admin@example.com", "Symposium Organiser", { department: "Organising Committee" });
  const jury = [
    await upsertUser("jury1@example.com", "Radhika Varma", { department: "Northwind Retail Group" }),
    await upsertUser("jury2@example.com", "Farhan Qureshi", { department: "LedgerLeaf" }),
    await upsertUser("jury3@example.com", "Dr. Meenakshi Rao", { department: "Institute of Management Studies" }),
    await upsertUser("jury4@example.com", "Karan Malhotra", { department: "Banyan Seed Ventures" }),
  ];
  const mentors = [
    await upsertUser("mentor1@example.com", "Rahul Bhatt", { department: "TeamLease EdTech" }),
    await upsertUser("mentor2@example.com", "Priya Kulkarni", { department: "Strategy Consultant" }),
  ];
  const students = await participants("bsym", 30, "Institute of Management Studies");

  await enrol(contest.id, admin.id, "admin");
  for (const j of jury) await enrol(contest.id, j.id, "judge");

  const teamDefs = [
    {
      name: "GreenLoop",
      cat: "Sustainability",
      approved: true,
      summary:
        "GreenLoop is a reverse-logistics marketplace that lets apparel brands buy back used garments from customers for store credit, then routes them to resale, repair or recycling partners.",
      problem: "Indian apparel brands lose margin on returns and face rising EPR obligations, while 80% of discarded clothing ends up in landfills.",
      market: "Mid-size D2C and retail apparel brands in India (~1,200 brands, ₹4,000 cr addressable buy-back value).",
      value: "Brands gain repeat customers and ESG-reportable diversion data; customers get instant credit.",
      model: "Per-item handling fee (₹40) + 8% take rate on resale + annual ESG reporting SaaS (₹3 lakh per brand).",
    },
    {
      name: "LedgerLite",
      cat: "Finance",
      approved: true,
      summary: "LedgerLite is a WhatsApp-first bookkeeping and invoice-financing tool for kirana stores and micro-distributors.",
      problem: "Small retailers keep credit in paper ledgers, can't prove cash flows to lenders and wait 30–60 days for dues.",
      market: "12 million kirana stores; initial focus on 150,000 FMCG micro-distributors in Tier-2 cities.",
      value: "Voice-note bookkeeping, automatic payment reminders and one-tap invoice discounting through NBFC partners.",
      model: "Freemium SaaS (₹199/month premium) + 1.5% origination fee on financed invoices.",
    },
    {
      name: "SkillBridge",
      cat: "HR",
      approved: true,
      summary: "SkillBridge helps manufacturing firms run apprenticeship programmes end-to-end — sourcing, on-the-job assessment and compliance.",
      problem: "Firms struggle to fill shop-floor roles while apprenticeship compliance is paperwork-heavy and under-used.",
      market: "15,000 mid-size manufacturers under the Apprentices Act; ₹2,500 cr annual programme spend.",
      value: "Cuts time-to-hire by 40% and automates stipend and portal compliance.",
      model: "Per-apprentice monthly fee (₹600) + placement success fee.",
    },
    {
      name: "PulseMetrics",
      cat: "Data Analytics",
      approved: true,
      summary: "PulseMetrics predicts store-level demand for quick-commerce dark stores using weather, events and local search trends.",
      problem: "Dark stores waste 6–9% of perishables and stock out on 12% of SKUs during demand spikes.",
      market: "4,000+ dark stores across 3 major quick-commerce players and regional grocers.",
      value: "Reduces wastage by a third and stock-outs by half in our pilot simulation.",
      model: "Per-store SaaS subscription (₹15,000/month) with a savings-share option.",
    },
    {
      name: "KisanConnect",
      cat: "Social Impact",
      approved: true,
      summary: "KisanConnect aggregates smallholder farmers into micro-FPOs to sell graded produce directly to institutional buyers.",
      problem: "Smallholders capture only 25–30% of the consumer rupee because of intermediaries and lack of grading.",
      market: "86% of India's farmers are smallholders; pilot in 3 districts of Maharashtra with 1,200 farmers.",
      value: "Transparent grading, assured offtake and next-day payments raise farmer income by an estimated 18%.",
      model: "2% commission from buyers + input sales margin + logistics fee.",
    },
    {
      name: "BrandSpark",
      cat: "Marketing",
      approved: true,
      summary: "BrandSpark turns local college creators into a managed micro-influencer network for regional D2C brands.",
      problem: "Regional brands can't access or measure authentic creator marketing in Tier-2/3 towns.",
      market: "8,000 regional D2C brands; ₹900 cr regional influencer spend growing 30% a year.",
      value: "Vetted creators, content in 9 languages and attributable sales via unique codes.",
      model: "Campaign management fee (15%) + performance bonus on attributed sales.",
    },
    {
      name: "DocuMind",
      cat: "AI for Business",
      approved: false,
      summary: "DocuMind reads procurement contracts and flags risky clauses and missed renewal dates for SMEs.",
      problem: "SMEs miss renewal windows and accept unfavourable terms because nobody reads the fine print.",
      market: "Mid-size companies with 200+ active vendor contracts.",
      value: "Clause risk scores and renewal alerts in plain language.",
      model: "Per-contract pricing with a monthly cap.",
    },
    {
      name: "UrbanNest",
      cat: "Business Strategy",
      approved: false,
      summary: "UrbanNest proposes a turnaround strategy for a struggling regional home-furnishing retailer.",
      problem: "Footfall down 22% and inventory turns falling as online players undercut on price.",
      market: "Regional furniture retail in western India.",
      value: "Omnichannel store-as-showroom model with assisted online sales.",
      model: "Consulting case — impact measured on gross margin and inventory turns.",
    },
  ];

  const roles = preset.roleConfig.map((r) => r.role);
  const createdTeams: Array<{ id: string; name: string; approved: boolean; def: (typeof teamDefs)[number] }> = [];
  let s = 0;
  for (const [i, def] of teamDefs.entries()) {
    const size = i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3;
    const members = students.slice(s, s + size);
    s += size;
    const [team] = await db
      .insert(teams)
      .values({
        name: def.name,
        contestId: contest.id,
        trackId: cat(def.cat),
        createdBy: members[0].id,
        leaderId: members[0].id,
        approved: def.approved,
      })
      .returning();
    for (const [mi, m] of members.entries()) {
      await enrol(contest.id, m.id, "participant", mi === 0 ? "Team Lead" : roles[Math.min(mi, roles.length - 1)], team.id);
    }
    createdTeams.push({ id: team.id, name: team.name, approved: def.approved, def });
  }
  // Unassigned participants (can use team finder / invitations)
  for (const m of students.slice(s)) await enrol(contest.id, m.id, "participant");
  // Mentors
  await enrol(contest.id, mentors[0].id, "mentor", "Mentor", createdTeams[0].id);
  await enrol(contest.id, mentors[1].id, "mentor", "Mentor", createdTeams[1].id);

  // Submissions + scores
  const criteria = preset.scoringCriteria;
  const feedbackBank = [
    "Clear problem framing and a credible customer. Strengthen the unit economics with real pricing data.",
    "Strong research. The go-to-market plan needs a sharper first 90 days and a named pilot customer.",
    "Good energy in the pitch. Quantify the market bottom-up rather than quoting top-down reports.",
    "Innovative idea with genuine impact. Clarify how you will defend against larger incumbents.",
    "The financial model is optimistic — stress-test churn and customer acquisition cost.",
    "Well-structured deck. Spend less time on the problem and more on why your team will win.",
  ];
  const approvedTeams = createdTeams.filter((t) => t.approved);
  for (const [ti, t] of approvedTeams.entries()) {
    const quality = 0.55 + (ti % 4) * 0.1; // spreads the leaderboard
    // Round 2 — concept note (all approved teams)
    const r2 = {
      executiveSummary: t.def.summary,
      problemStatement: t.def.problem,
      targetMarket: t.def.market,
      valueProposition: t.def.value,
    };
    const [s2] = await db.insert(submissions).values({ teamId: t.id, phase: 2, fields: r2, ...legacyColumnsFrom(r2) }).returning();

    // Round 3 — business plan (first 5)
    let s3: typeof s2 | null = null;
    if (ti < 5) {
      const research = await saveUpload(
        "submission_file",
        "pdf",
        makePdf(`${t.name} — Market Research`, [
          [`${t.name}: Market Research Report`, "Business Symposium 2026 - Round 3", "", "Prepared by the team"],
          ["Key findings", `- ${t.def.market}`, "- Primary survey: 214 respondents across 3 cities", "- 68% would switch for a better experience", "- Top barrier: trust and onboarding effort"],
          ["Competitive landscape", "- 3 direct competitors, none focused on our segment", "- Incumbents compete on price, not service", "- Our wedge: " + t.def.value.slice(0, 70)],
        ]),
      );
      const deck = await saveUpload(
        "submission_file",
        "pdf",
        makePdf(`${t.name} — Pitch Deck (draft)`, [
          [t.name, "Pitch deck - draft for mentor review", "", t.def.summary.slice(0, 90)],
          ["The problem", t.def.problem.slice(0, 90), t.def.problem.slice(90, 180)],
          ["Business model", t.def.model.slice(0, 90), t.def.model.slice(90, 180)],
          ["The ask", "Pilot partner + mentorship", "Seed support to validate in 2 cities"],
        ]),
      );
      const fin = await saveUpload("submission_file", "xlsx", await financialModelXlsx(t.name));
      const r3 = {
        executiveSummary: t.def.summary,
        targetMarket: t.def.market,
        businessModel: t.def.model,
        sustainabilityImpact: "We track environmental and inclusion metrics from day one and report them quarterly.",
        marketResearch: research,
        financialModel: fin,
        pitchDeck: deck,
      };
      [s3] = await db.insert(submissions).values({ teamId: t.id, phase: 3, fields: r3, ...legacyColumnsFrom(r3) }).returning();
    }

    // Round 4 — finale deck (first 2 teams already uploaded)
    if (ti < 2) {
      const finalDeck = await saveUpload(
        "submission_file",
        "pdf",
        makePdf(`${t.name} — Final Pitch`, [
          [t.name, "Grand Finale pitch", "", t.def.summary.slice(0, 90)],
          ["Traction", "- 3 pilot LOIs signed", "- 1,200 waitlist sign-ups", "- Mentor-validated unit economics"],
          ["Why us", "- Founding team covers strategy, finance and marketing", "- Deep customer access through our pilot partners"],
        ]),
      );
      const r4 = { executiveSummary: t.def.summary, businessModel: t.def.model, pitchDeck: finalDeck, prototypeUrl: "https://example.com/prototype" };
      await db.insert(submissions).values({ teamId: t.id, phase: 4, fields: r4, ...legacyColumnsFrom(r4) });
    }

    // Jury scores (1–10) with feedback
    const scoreFor = () => {
      const cs: Record<string, number> = {};
      for (const c of criteria) cs[c.key] = Math.max(1, Math.min(10, Math.round(quality * 10 + (rand() * 3 - 1.5))));
      return cs;
    };
    for (const [ji, j] of jury.entries()) {
      await db.insert(scores).values({
        submissionId: s2.id,
        judgeId: j.id,
        criteriaScores: scoreFor(),
        feedback: feedbackBank[(ti + ji) % feedbackBank.length],
        privateNote: ji === 0 ? "Shortlist candidate" : null,
      });
      if (s3 && ji < 3) {
        await db.insert(scores).values({
          submissionId: s3.id,
          judgeId: j.id,
          criteriaScores: scoreFor(),
          feedback: feedbackBank[(ti + ji + 2) % feedbackBank.length],
        });
      }
    }
  }

  // Finale queue ready for the live control room
  const live: LiveState = {
    phase: 4,
    currentTeamId: null,
    scoringOpen: false,
    queue: approvedTeams.map((t) => t.id),
    timerEndsAt: null,
    revealStage: "hidden",
    updatedAt: Date.now(),
  };
  await db
    .update(contests)
    .set({
      liveState: live,
      // Pending custom domain — becomes live once DNS/tunnel points at the app and it's verified.
      customDomain: process.env.SEED_SYMPOSIUM_DOMAIN || null,
    })
    .where(eq(contests.id, contest.id));

  console.log(`created: ${slug} (${createdTeams.length} teams, ${students.length} students)`);
}

// ---------------------------------------------------------------------------
// 2. Hackathon (new preset with per-round fields, 12 problem statements)
// ---------------------------------------------------------------------------

async function seedHackathon(creatorId: string) {
  const slug = "ai-hackathon-2026";
  if (await db.query.contests.findFirst({ where: eq(contests.slug, slug) })) {
    console.log(`skip: ${slug} exists (use --reset to rebuild)`);
    return;
  }
  const preset = getPreset("hackathon");
  const statements = [
    ["AI Admission Counsellor", "Conversational assistant that answers programme, fee and eligibility questions 24x7."],
    ["Smart Lead Scoring", "Rank incoming leads by likelihood to enrol using activity signals."],
    ["Exam Proctoring Insights", "Summarise proctoring flags into a reviewer-friendly timeline."],
    ["Alumni Mentor Match", "Match current learners with alumni mentors by goals and background."],
    ["Course Content Tutor", "Course-scoped AI tutor over lecture notes and slides."],
    ["Attendance Anomaly Detector", "Flag learners at risk of dropping out from attendance patterns."],
    ["Placement Readiness Coach", "Mock interviews with feedback on answers and communication."],
    ["Fee Reminder Optimiser", "Pick the best channel and time to remind learners about dues."],
    ["Document Verification Bot", "Extract and verify details from marksheets and ID documents."],
    ["Counsellor Call Summariser", "Summarise counselling calls and suggest next best action."],
    ["Campus Event Planner", "Plan and publicise campus events with automated schedules."],
    ["Learning Path Recommender", "Recommend short courses from a learner's goals and gaps."],
  ];
  const contest = await createContestFromPreset({
    type: "hackathon",
    name: "AI Symposium Hackathon 2026",
    slug,
    createdBy: creatorId,
    overrides: {
      status: "active",
      heroTitle: "AI Symposium Hackathon",
      heroSubtitle: "An Innovation Challenge for AI & Emerging Technologies",
      description: "12 problem statements, one team per statement. Build with AI-assisted development over two sprints and a Demo Day.",
      settings: { ...preset.settings, exclusiveTracks: true },
      terminology: { track: "Problem Statement", phase: "Phase", judge: "Judge", submission: "Submission" },
      tracks: statements.map(([name, description]) => ({ name, description })),
      startDate: isoDay("2026-09-15"),
      endDate: isoDay("2026-11-30"),
      registrationDeadline: isoDay("2026-10-15"),
      maxApprovedTeams: 12,
    },
  });
  const probs = await db.query.tracks.findMany({ where: eq(tracks.contestId, contest.id), orderBy: (t, { asc }) => [asc(t.sortOrder)] });

  const admin = await upsertUser("hackathon.admin@example.com", "Hackathon Organiser", { department: "Tech Team" });
  const judges = [
    await upsertUser("judge1@example.com", "Neha Arora", { department: "Engineering" }),
    await upsertUser("judge2@example.com", "Sameer Joshi", { department: "Product" }),
    await upsertUser("judge3@example.com", "Lakshmi Iyer", { department: "Data Science" }),
  ];
  const devs = await participants("hack", 20, "TeamLease EdTech");
  await enrol(contest.id, admin.id, "admin");
  for (const j of judges) await enrol(contest.id, j.id, "judge");

  const names = ["Prompt Pioneers", "Neural Knights", "Byte Brigade", "Code Catalysts", "Vibe Coders"];
  let s = 0;
  const roleCycle = ["Team Lead", "Developer", "Developer", "Product SPOC", "QA/Testing Owner"];
  for (const [i, name] of names.entries()) {
    const members = devs.slice(s, s + 4);
    s += 4;
    const [team] = await db
      .insert(teams)
      .values({ name, contestId: contest.id, trackId: probs[i].id, createdBy: members[0].id, leaderId: members[0].id, approved: i < 4 })
      .returning();
    for (const [mi, m] of members.entries()) await enrol(contest.id, m.id, "participant", roleCycle[mi], team.id);
    if (i >= 4) continue;
    const scope = await saveUpload(
      "submission_file",
      "pdf",
      makePdf(`${name} — Statement of Work`, [
        [`${name}: Statement of Work`, `Problem: ${probs[i].name}`, "", "Scope, technical plan and prompt strategy"],
        ["Architecture", "- Next.js front end", "- LLM with retrieval over curated content", "- Postgres for state"],
      ]),
    );
    const v = {
      scopeDocument: scope,
      githubUrl: `https://github.com/example/${name.toLowerCase().replace(/\s+/g, "-")}`,
      submissionDescription: `Sprint 1 progress for ${probs[i].name}: scope agreed, UI sketched with AI tools, backend scaffolded.`,
      aiPromptsUsed: "Generate a Next.js page for ...; Write unit tests for ...; Summarise this spec into user stories",
      aiToolsUtilized: "Claude, GitHub Copilot, v0",
      aiScreenshots: ["https://placehold.co/800x450/png?text=AI+usage+evidence"],
    };
    const [sub] = await db.insert(submissions).values({ teamId: team.id, phase: 2, fields: v, ...legacyColumnsFrom(v) }).returning();
    for (const j of judges) {
      const cs: Record<string, number> = {};
      for (const c of preset.scoringCriteria) cs[c.key] = pickInt(55, 92);
      await db.insert(scores).values({ submissionId: sub.id, judgeId: j.id, criteriaScores: cs, feedback: "Good start — show more AI evidence in the next checkpoint." });
    }
  }
  for (const m of devs.slice(s)) await enrol(contest.id, m.id, "participant");
  console.log(`created: ${slug}`);
}

// ---------------------------------------------------------------------------
// 3. Draft symposium for admin / AI-setup testing
// ---------------------------------------------------------------------------

async function seedDraft(creatorId: string) {
  const slug = "campus-startup-pitch";
  if (await db.query.contests.findFirst({ where: eq(contests.slug, slug) })) {
    console.log(`skip: ${slug} exists`);
    return;
  }
  await createContestFromPreset({
    type: "business_symposium",
    name: "Campus Startup Pitch (Draft)",
    slug,
    createdBy: creatorId,
    overrides: {
      status: "draft",
      heroSubtitle: "A one-day startup pitch competition for first-year MBA students",
      tracks: [
        { name: "Startup Pitch Competition", description: "Pitch an investable early-stage startup." },
        { name: "Social Impact Innovation Challenge", description: "Scalable solutions for inclusion and livelihoods." },
      ],
    },
  });
  console.log(`created: ${slug} (draft)`);
}

// ---------------------------------------------------------------------------

async function main() {
  if (RESET) await reset();
  // Contest creator = first platform admin (falls back to a seed organiser account)
  const pa = await db.query.users.findFirst({ where: eq(users.globalRole, "platform_admin") });
  const creator = pa ?? (await upsertUser("platform.admin@example.com", "Platform Admin", { globalRole: "platform_admin" }));
  await seedSymposium(creator.id);
  await seedHackathon(creator.id);
  await seedDraft(creator.id);
  console.log(`\nDone. Files in ${UPLOADS}. All @example.com test accounts use SEED_PASSWORD.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
