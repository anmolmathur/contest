/**
 * Offline judging sheet download.
 *
 * A judge downloads an .xlsx pre-filled with:
 *  - One sheet per scorable phase (or just the requested phase),
 *  - One row per approved team & submission,
 *  - Editable score columns (one per scoring criterion, 0-100),
 *  - A weighted-total formula column that updates live in Excel,
 *  - A free-form Notes column for offline observations.
 *
 * Judges use it to work offline (during demo day, weak wifi, etc.) and
 * later enter their scores into the portal. The sheet is a work aid,
 * NOT authoritative — nothing here gets imported back automatically.
 *
 *   GET /api/c/[slug]/judging-sheet               → all scorable phases, one sheet each
 *   GET /api/c/[slug]/judging-sheet?phase=3       → only phase 3
 *
 * Auth: contest judge or admin (platform admins: inspect-only is fine since
 * the sheet is read-only output and downloading it does nothing to DB state).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, users } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  resolveContest,
  canJudgeContest,
  isPlatformAdmin,
} from "@/lib/contest-auth";
import ExcelJS from "exceljs";

type ScoringCriterion = { name: string; key: string; weight: number; description?: string };
type PhaseConfig = {
  phase: number;
  name: string;
  maxPoints: number;
  startDate?: string;
  endDate?: string;
  deliverables?: string[];
};

// Brand-ish colors matching the site (hex without the # for ExcelJS).
const C_HEADER_BG = "FF1F1333";
const C_HEADER_FG = "FFFFFFFF";
const C_SUBHEADER_BG = "FF2B1B4F";
const C_ROW_ALT = "FFF8F6FC";
const C_EDITABLE_BG = "FFFFF9E6";
const C_FORMULA_BG = "FFE7F0FF";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  const canJudge = await canJudgeContest(session.user.id, contest.id);
  const canInspect = await isPlatformAdmin(session.user.id);
  if (!canJudge && !canInspect) {
    return NextResponse.json({ error: "Only judges or platform admins can download" }, { status: 403 });
  }

  const scoringCriteria = (contest.scoringCriteria as ScoringCriterion[] | null) ?? [];
  const phaseConfigAll = (contest.phaseConfig as PhaseConfig[] | null) ?? [];
  const scorablePhases = phaseConfigAll.filter((p) => p.maxPoints > 0);
  if (scorablePhases.length === 0 || scoringCriteria.length === 0) {
    return NextResponse.json(
      { error: "Contest has no scorable phases or no scoring criteria configured" },
      { status: 400 }
    );
  }

  const phaseFilter = req.nextUrl.searchParams.get("phase");
  const chosenPhases = phaseFilter && phaseFilter !== "all"
    ? scorablePhases.filter((p) => String(p.phase) === phaseFilter)
    : scorablePhases;
  if (chosenPhases.length === 0) {
    return NextResponse.json({ error: "Requested phase is not scorable" }, { status: 400 });
  }

  // Data: approved teams + their submissions.
  const approvedTeams = await db.query.teams.findMany({
    where: and(eq(teams.contestId, contest.id), eq(teams.approved, true)),
    with: { trackRef: { columns: { id: true, name: true } } },
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  const teamSubmissions = approvedTeams.length === 0
    ? []
    : await db.query.submissions.findMany({
        where: inArray(submissions.teamId, approvedTeams.map((t) => t.id)),
      });

  // Judge metadata (goes into header)
  const judge = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Contest Platform";
  wb.created = new Date();

  // Total weight for the normalized formula.
  const totalWeight = scoringCriteria.reduce((s, c) => s + (Number(c.weight) || 0), 0) || 1;

  // ---------- INSTRUCTIONS sheet -----------------------------------------
  const intro = wb.addWorksheet("Instructions", {
    properties: { tabColor: { argb: "FF7C3AED" } },
  });
  intro.columns = [{ width: 24 }, { width: 80 }];
  intro.addRow([contest.name]).font = { bold: true, size: 18, color: { argb: "FF7C3AED" } };
  intro.addRow(["Offline Judging Sheet"]).font = { italic: true, color: { argb: "FF555555" } };
  intro.addRow([]);
  intro.addRow(["Generated for:", judge?.name ?? judge?.email ?? "(unknown judge)"]);
  intro.addRow(["Generated on:", new Date().toLocaleString()]);
  intro.addRow(["Contest status:", contest.status]);
  intro.addRow([]);
  intro.addRow(["How to use this sheet"]).font = { bold: true, size: 13 };
  [
    "• Each scorable phase is a separate tab (Phase 2, Phase 3, …). Each row is one submission.",
    "• Score each criterion from 0 to 100 in the YELLOW cells. Blank cells are treated as 0.",
    "• The TOTAL column updates automatically using the weighted formula shown in the header.",
    "• Use the Notes column for any offline observations.",
    "• When you're done, copy your scores into the portal at the matching URL.",
    "• This sheet is a working copy — nothing here is submitted automatically.",
  ].forEach((l) => intro.addRow(["", l]));

  intro.addRow([]);
  intro.addRow(["Scoring criteria & weights"]).font = { bold: true, size: 13 };
  intro.addRow(["Criterion", "Weight"]).font = { bold: true };
  scoringCriteria.forEach((c) =>
    intro.addRow([c.name, Number(c.weight).toFixed(2)])
  );
  intro.addRow(["Total", totalWeight.toFixed(2)]).font = { bold: true };

  intro.addRow([]);
  intro.addRow(["Phases covered"]).font = { bold: true, size: 13 };
  intro.addRow(["Phase", "Name", "Max points"]).font = { bold: true };
  chosenPhases.forEach((p) => intro.addRow([p.phase, p.name, p.maxPoints]));

  // ---------- PHASE sheets -----------------------------------------------
  for (const phase of chosenPhases) {
    const ws = wb.addWorksheet(`Phase ${phase.phase}`, {
      views: [{ state: "frozen", xSplit: 2, ySplit: 4 }],
    });

    // Column layout: | # | Team | Track | Submitted? | GitHub | Demo | <crits...> | Weighted Total | Phase Pts | Notes |
    const critCount = scoringCriteria.length;
    const colCount = 6 + critCount + 3;
    ws.columns = [
      { width: 4 },        // #
      { width: 28 },       // Team
      { width: 18 },       // Track
      { width: 12 },       // Submitted?
      { width: 38 },       // GitHub
      { width: 38 },       // Demo
      ...scoringCriteria.map((c) => ({ width: Math.max(16, c.name.length + 4) })),
      { width: 16 },       // Weighted Total (0-100)
      { width: 12 },       // Phase Points
      { width: 40 },       // Notes
    ];

    // Row 1 — Title
    const titleRow = ws.addRow([`${contest.name} — Phase ${phase.phase}: ${phase.name} (${phase.maxPoints} pts)`]);
    titleRow.font = { bold: true, size: 14, color: { argb: C_HEADER_FG } };
    ws.mergeCells(1, 1, 1, colCount);
    titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_HEADER_BG } };
    titleRow.height = 26;
    titleRow.alignment = { vertical: "middle", indent: 1 };

    // Row 2 — subtitle with judge + formula hint
    const subtitle = ws.addRow([
      `Judge: ${judge?.name ?? judge?.email ?? "(unknown)"}`,
      "",
      "",
      "",
      "",
      "",
      ...scoringCriteria.map((c) => `weight ${c.weight}`),
      "weighted 0-100",
      "scaled pts",
      "",
    ]);
    subtitle.font = { color: { argb: "FFBBBBBB" }, italic: true };
    subtitle.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_SUBHEADER_BG } };
    subtitle.getCell(1).font = { color: { argb: C_HEADER_FG }, italic: true };
    ws.mergeCells(2, 1, 2, 6);
    subtitle.getCell(1).alignment = { vertical: "middle", indent: 1 };

    // Row 3 — deliverables hint if we have them
    if (phase.deliverables && phase.deliverables.length > 0) {
      const delivRow = ws.addRow([`Deliverables: ${phase.deliverables.join(" · ")}`]);
      ws.mergeCells(3, 1, 3, colCount);
      delivRow.font = { italic: true, color: { argb: "FF666666" }, size: 10 };
      delivRow.getCell(1).alignment = { vertical: "middle", indent: 1 };
    } else {
      ws.addRow([]);
    }

    // Row 4 — table headers
    const header = ws.addRow([
      "#", "Team", "Track", "Submitted?", "GitHub", "Demo",
      ...scoringCriteria.map((c) => c.name),
      "Weighted 0-100", "Phase Pts", "Notes",
    ]);
    header.font = { bold: true, color: { argb: C_HEADER_FG } };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_HEADER_BG } };
      cell.border = { bottom: { style: "medium", color: { argb: "FF7C3AED" } } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });

    // Data rows
    approvedTeams.forEach((team, idx) => {
      const submission = teamSubmissions.find(
        (s) => s.teamId === team.id && s.phase === phase.phase,
      );
      const rowNum = idx + 1;
      const row = ws.addRow([
        rowNum,
        team.name,
        team.trackRef?.name ?? team.track ?? "",
        submission ? "Yes" : "—",
        submission?.githubUrl ?? "",
        submission?.demoUrl ?? "",
        ...scoringCriteria.map(() => null),    // blank score cells for the judge to fill
        null,                                  // weighted total (formula)
        null,                                  // scaled phase pts (formula)
        "",                                    // notes
      ]);

      const firstCritCol = 7;
      const lastCritCol = 6 + critCount;
      const totalCol = lastCritCol + 1;
      const scaledCol = lastCritCol + 2;

      // Format score cells: 0-100, editable visual (light yellow), validation 0-100
      for (let c = firstCritCol; c <= lastCritCol; c++) {
        const cell = row.getCell(c);
        cell.numFmt = "0";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_EDITABLE_BG } };
        cell.alignment = { horizontal: "center" };
        cell.dataValidation = {
          type: "whole",
          operator: "between",
          formulae: [0, 100],
          showErrorMessage: true,
          errorTitle: "Invalid score",
          error: "Scores must be whole numbers between 0 and 100.",
        };
      }

      // Weighted total formula = SUMPRODUCT(weights * scores) / SUM(weights)
      const weightRefs = scoringCriteria.map((c) => Number(c.weight));
      const weightsArray = `{${weightRefs.map((w) => w).join(",")}}`;
      const scoresRange = `${ws.getCell(row.number, firstCritCol).address}:${ws.getCell(row.number, lastCritCol).address}`;
      const weightedFormula = `SUMPRODUCT(${weightsArray},${scoresRange})/${totalWeight || 1}`;
      row.getCell(totalCol).value = { formula: weightedFormula, result: 0 };
      row.getCell(totalCol).numFmt = "0.0";
      row.getCell(totalCol).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: C_FORMULA_BG },
      };
      row.getCell(totalCol).font = { bold: true };
      row.getCell(totalCol).alignment = { horizontal: "center" };

      // Scaled to phase max points
      row.getCell(scaledCol).value = {
        formula: `${ws.getCell(row.number, totalCol).address}/100*${phase.maxPoints}`,
        result: 0,
      };
      row.getCell(scaledCol).numFmt = "0.0";
      row.getCell(scaledCol).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: C_FORMULA_BG },
      };
      row.getCell(scaledCol).alignment = { horizontal: "center" };

      // Alternating row banding in the non-editable columns for readability.
      if (idx % 2 === 0) {
        for (let c = 1; c <= 6; c++) {
          row.getCell(c).fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: C_ROW_ALT },
          };
        }
      }
    });

    // Summary row: count of submitted / not submitted
    const summaryRowNum = ws.lastRow!.number + 2;
    const summary = ws.getRow(summaryRowNum);
    summary.getCell(2).value = "Teams total:";
    summary.getCell(3).value = approvedTeams.length;
    summary.getCell(4).value = "Submitted:";
    summary.getCell(5).value = {
      formula: `COUNTIF(D5:D${approvedTeams.length + 4},"Yes")`,
      result: 0,
    };
    summary.font = { italic: true, color: { argb: "FF555555" } };

    // Header row height and freeze pane were already set via `views`.
    // Hyperlink the GitHub / Demo cells (if non-empty) — ExcelJS picks them up
    // automatically when the value is a string URL; we nudge the style here.
    for (let r = 5; r <= approvedTeams.length + 4; r++) {
      for (const c of [5, 6]) {
        const cell = ws.getCell(r, c);
        if (typeof cell.value === "string" && /^https?:\/\//i.test(cell.value)) {
          cell.value = { text: cell.value, hyperlink: cell.value };
          cell.font = { color: { argb: "FF2563EB" }, underline: true };
        }
      }
    }
  }

  // ---------- Deliver the file -------------------------------------------
  const buffer = await wb.xlsx.writeBuffer();
  const body = new Uint8Array(buffer as ArrayBuffer);

  const safeSlug = contest.slug.replace(/[^a-z0-9-]/gi, "_");
  const phaseTag = phaseFilter && phaseFilter !== "all" ? `-phase${phaseFilter}` : "-all-phases";
  const filename = `${safeSlug}-judging-sheet${phaseTag}.xlsx`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
