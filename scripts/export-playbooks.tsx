/**
 * Write the Ideathon stakeholder playbooks as PDFs.
 *
 *   npx tsx scripts/export-playbooks.tsx [outDir]            # generic (week labels, no dates)
 *   DATABASE_URL=... npx tsx scripts/export-playbooks.tsx out --slug=<contest>   # with that contest's dates/wording
 *
 * Default outDir: docs/guides/ideathon
 */
import fs from "node:fs/promises";
import path from "node:path";
import ReactPDF from "@react-pdf/renderer";
import { PlaybookDocument } from "@/components/ideathon/PlaybookPDF";
import { IDEATHON_PLAYBOOKS, STAKEHOLDER_ORDER, fillTokens } from "@/lib/playbooks/ideathon";
import { getPreset } from "@/lib/contest-types";
import { term, type Terminology } from "@/lib/contest-config";
import { AIDEATHON_WORDMARK, resolveWordmark, type WordmarkSegment } from "@/lib/wordmark";

const FILES: Record<string, string> = {
  participant: "Participant_Guide.pdf",
  jury: "Jury_Guide.pdf",
  auditor: "Auditor_Guide.pdf",
  "tech-buddy": "Tech_Buddy_Guide.pdf",
  sponsor: "Sponsor_Guide.pdf",
  organiser: "Organiser_Guide.pdf",
};
const WEEKS: Record<number, string> = { 1: "Week 1", 2: "Week 2", 3: "Week 3", 4: "Weeks 4–5", 5: "Week 6" };

async function main() {
  const outDir = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "docs/guides/ideathon";
  const slug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];

  const preset = getPreset("ideathon");
  let contestName = "TLE AIdeathon 2026";
  let terminology: Terminology = preset.terminology;
  let wordmark: WordmarkSegment[] | null = AIDEATHON_WORDMARK;
  let phases: Array<{ phase: number; name: string; startDate?: string; endDate?: string }> = preset.phaseConfig;

  if (slug) {
    const { db } = await import("@/lib/db");
    const { contests } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const c = await db.query.contests.findFirst({ where: eq(contests.slug, slug) });
    if (!c) throw new Error(`No contest ${slug}`);
    contestName = c.name;
    terminology = (c.terminology as Terminology) ?? terminology;
    wordmark = resolveWordmark(c.brandingConfig);
    phases = (c.phaseConfig as typeof phases) ?? phases;
  }

  const fmt = (d?: string) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
  const stageLabel = (n: number) => {
    if (n === 0) return { name: "Before launch", dates: "" };
    const p = phases.find((x) => x.phase === n);
    const dates = p?.startDate ? `${fmt(p.startDate)}${p.endDate && p.endDate !== p.startDate ? ` – ${fmt(p.endDate)}` : ""}` : WEEKS[n] ?? "";
    return { name: p?.name ?? `Stage ${n}`, dates };
  };
  const tr = (x: string) => fillTokens(x, (k) => term(terminology, k));

  await fs.mkdir(outDir, { recursive: true });
  for (const key of STAKEHOLDER_ORDER) {
    const file = path.join(outDir, FILES[key]);
    await ReactPDF.renderToFile(
      PlaybookDocument({ contestName, wordmark, playbook: IDEATHON_PLAYBOOKS[key], tr, stageLabel }),
      file,
    );
    console.log(`wrote ${file}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
