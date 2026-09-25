import { NextRequest, NextResponse } from "next/server";
import ReactPDF from "@react-pdf/renderer";
import { resolveContest } from "@/lib/contest-auth";
import { term, type Terminology } from "@/lib/contest-config";
import { IDEATHON_PLAYBOOKS, STAKEHOLDER_ORDER, fillTokens, type StakeholderKey } from "@/lib/playbooks/ideathon";
import { resolveWordmark, wordmarkText } from "@/lib/wordmark";
import { PlaybookDocument } from "@/components/ideathon/PlaybookPDF";

/** GET /api/c/[slug]/playbook/[stakeholder]/pdf — public (non-draft) stakeholder playbook PDF. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; stakeholder: string }> }) {
  try {
    const { slug, stakeholder } = await params;
    const contest = await resolveContest(slug);
    if (!contest || contest.status === "draft") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!STAKEHOLDER_ORDER.includes(stakeholder as StakeholderKey)) {
      return NextResponse.json({ error: "Unknown stakeholder" }, { status: 404 });
    }
    const pb = IDEATHON_PLAYBOOKS[stakeholder as StakeholderKey];
    const terminology = contest.terminology as Terminology | null;
    const tr = (x: string) => fillTokens(x, (k) => term(terminology, k));
    const phases = (Array.isArray(contest.phaseConfig) ? contest.phaseConfig : []) as Array<{
      phase: number;
      name: string;
      startDate?: string;
      endDate?: string;
    }>;
    const fmt = (d?: string) =>
      d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
    const stageLabel = (n: number) => {
      if (n === 0) return { name: "Before launch", dates: "" };
      const p = phases.find((x) => x.phase === n);
      return {
        name: p?.name ?? `${term(terminology, "phase")} ${n}`,
        dates: p?.startDate ? `${fmt(p.startDate)}${p.endDate && p.endDate !== p.startDate ? ` – ${fmt(p.endDate)}` : ""}` : "",
      };
    };
    const wordmark = resolveWordmark(contest.brandingConfig);
    const stream = await ReactPDF.renderToStream(
      PlaybookDocument({ contestName: contest.name, wordmark, playbook: pb, tr, stageLabel }),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const base = (wordmarkText(wordmark) || contest.slug).replace(/[^A-Za-z0-9]+/g, "_");
    return new NextResponse(Buffer.concat(chunks), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${base}_${pb.title.replace(/[^A-Za-z0-9]+/g, "_")}_Guide.pdf"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Playbook PDF error:", error);
    return NextResponse.json({ error: "Failed to build PDF" }, { status: 500 });
  }
}
