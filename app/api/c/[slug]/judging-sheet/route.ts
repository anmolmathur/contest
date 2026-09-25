/**
 * Offline judging sheet download.
 *
 * A judge downloads an .xlsx pre-filled with:
 *  - One sheet per scorable phase/round (or just the requested one),
 *  - One row per approved team & submission, with the submission's fields
 *    for that phase (links hyperlinked, long text truncated),
 *  - Editable score columns (one per scoring criterion, on the contest's
 *    scale, e.g. 0–100 or 1–10), pre-filled with the judge's own scores,
 *  - A weighted-total formula column (normalised to 0–100) and the scaled
 *    phase points, both updating live in Excel,
 *  - Feedback (pre-filled with the judge's own feedback) and Notes columns.
 *
 * Judges use it to work offline (during demo day, weak wifi, etc.) and
 * later enter their scores into the portal. The sheet is a work aid,
 * NOT authoritative — nothing here gets imported back automatically.
 *
 *   GET /api/c/[slug]/judging-sheet               → all scorable phases, one sheet each
 *   GET /api/c/[slug]/judging-sheet?phase=3       → only phase 3
 *
 * Auth: contest judge or admin (platform admins included).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, submissions, scores, users } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { resolveContest, canJudgeContest, isPlatformAdmin } from "@/lib/contest-auth";
import { resolveScale, term, termPlural, type SubmissionField } from "@/lib/contest-config";
import { resolveSubmissionFields, fieldsForPhase, submissionValues, displayValue } from "@/lib/submission-fields";
import { contestTerminology } from "@/lib/api-input";
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
const C_LINK = "FF2563EB";

const TEXT_LIMIT = 500;

function isLinkField(f: SubmissionField): boolean {
  return f.type === "url" || f.type === "urlList" || f.type === "file" || f.type === "fileList";
}

function truncate(s: string, n = TEXT_LIMIT): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function fieldColumnWidth(f: SubmissionField): number {
  if (f.type === "textarea") return 48;
  if (isLinkField(f)) return 36;
  return Math.max(16, Math.min(32, f.label.length + 4));
}

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

  const terminology = contestTerminology(contest);
  const T = {
    track: term(terminology, "track"),
    phase: term(terminology, "phase"),
    judge: term(terminology, "judge"),
    judges: termPlural(terminology, "judge"),
    team: term(terminology, "team"),
    submission: term(terminology, "submission"),
  };

  const scale = resolveScale(contest.scoringScale);
  const span = scale.max - scale.min || 1;
  const wholeSteps = Number.isInteger(scale.step) && Number.isInteger(scale.min) && Number.isInteger(scale.max);

  const fieldDefs = resolveSubmissionFields(contest.submissionFields);
  const scoringCriteria = (contest.scoringCriteria as ScoringCriterion[] | null) ?? [];
  const phaseConfigAll = (contest.phaseConfig as PhaseConfig[] | null) ?? [];
  const scorablePhases = phaseConfigAll.filter((p) => p.maxPoints > 0);
  if (scorablePhases.length === 0 || scoringCriteria.length === 0) {
    return NextResponse.json(
      { error: `Contest has no scorable ${termPlural(terminology, "phase").toLowerCase()} or no scoring criteria configured` },
      { status: 400 }
    );
  }

  const phaseFilter = req.nextUrl.searchParams.get("phase");
  const chosenPhases = phaseFilter && phaseFilter !== "all"
    ? scorablePhases.filter((p) => String(p.phase) === phaseFilter)
    : scorablePhases;
  if (chosenPhases.length === 0) {
    return NextResponse.json({ error: `Requested ${T.phase.toLowerCase()} is not scorable` }, { status: 400 });
  }

  // Data: approved teams + their submissions + this judge's own scores.
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

  const myScores = teamSubmissions.length === 0
    ? []
    : await db.query.scores.findMany({
        where: and(
          inArray(scores.submissionId, teamSubmissions.map((s) => s.id)),
          eq(scores.judgeId, session.user.id),
        ),
        columns: { submissionId: true, criteriaScores: true, feedback: true },
      });
  const myScoreBySubmission = new Map(myScores.map((s) => [s.submissionId, s]));

  // Judge metadata (goes into header)
  const judge = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { name: true, email: true },
  });
  const judgeName = judge?.name ?? judge?.email ?? `(unknown ${T.judge.toLowerCase()})`;

  // Absolute URLs for our own relative upload links, so Excel can open them.
  const origin = req.nextUrl.origin;
  const absolute = (u: string) => (u.startsWith("/") ? `${origin}${u}` : u);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Contest Platform";
  wb.created = new Date();
  // Recalculate formulas on open (score cells may be pre-filled).
  wb.calcProperties.fullCalcOnLoad = true;

  // Total weight for the normalized formula.
  const totalWeight = scoringCriteria.reduce((s, c) => s + (Number(c.weight) || 0), 0) || 1;

  // ---------- INSTRUCTIONS sheet -----------------------------------------
  const intro = wb.addWorksheet("Instructions", {
    properties: { tabColor: { argb: "FF7C3AED" } },
  });
  intro.columns = [{ width: 24 }, { width: 80 }, { width: 14 }];
  intro.addRow([contest.name]).font = { bold: true, size: 18, color: { argb: "FF7C3AED" } };
  intro.addRow([`Offline ${T.judge} Sheet`]).font = { italic: true, color: { argb: "FF555555" } };
  intro.addRow([]);
  intro.addRow(["Generated for:", judgeName]);
  intro.addRow(["Generated on:", new Date().toLocaleString()]);
  intro.addRow(["Contest status:", contest.status]);
  intro.addRow([]);
  intro.addRow(["How to use this sheet"]).font = { bold: true, size: 13 };
  [
    `• Each scorable ${T.phase.toLowerCase()} is a separate tab (${T.phase} 2, ${T.phase} 3, …). Each row is one ${T.team.toLowerCase()}.`,
    `• Score each criterion from ${scale.min} to ${scale.max} in the YELLOW cells. Blank cells count as the lowest score (${scale.min}).`,
    "• Any scores you already entered in the portal are pre-filled.",
    `• The WEIGHTED column normalises your scores to 0–100 and applies the criterion weights; PTS scales that to the ${T.phase.toLowerCase()}'s maximum points.`,
    `• Use the Feedback column for comments the ${T.team.toLowerCase()} will see once results are published, and Notes for your own observations.`,
    "• When you're done, copy your scores and feedback into the portal.",
    "• This sheet is a working copy — nothing here is submitted automatically.",
  ].forEach((l) => intro.addRow(["", l]));

  if (scale.labels && scale.labels.length > 0) {
    intro.addRow([]);
    intro.addRow(["Scoring rubric"]).font = { bold: true, size: 13 };
    intro.addRow(["Score", "Meaning"]).font = { bold: true };
    [...scale.labels]
      .sort((a, b) => b.min - a.min)
      .forEach((l) => intro.addRow([l.min === l.max ? `${l.min}` : `${l.min}–${l.max}`, l.label]));
  }

  intro.addRow([]);
  intro.addRow(["Scoring criteria & weights"]).font = { bold: true, size: 13 };
  intro.addRow(["Criterion", "Description", "Weight"]).font = { bold: true };
  scoringCriteria.forEach((c) =>
    intro.addRow([c.name, c.description ?? "", Number(c.weight).toFixed(2)])
  );
  intro.addRow(["Total", "", totalWeight.toFixed(2)]).font = { bold: true };

  intro.addRow([]);
  intro.addRow([`${termPlural(terminology, "phase")} covered`]).font = { bold: true, size: 13 };
  intro.addRow([T.phase, "Name", "Max points"]).font = { bold: true };
  chosenPhases.forEach((p) => intro.addRow([p.phase, p.name, p.maxPoints]));
  intro.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  // ---------- PHASE sheets -----------------------------------------------
  for (const phase of chosenPhases) {
    const phaseFields = fieldsForPhase(fieldDefs, phase.phase);
    const ws = wb.addWorksheet(`${T.phase} ${phase.phase}`.slice(0, 31), {
      views: [{ state: "frozen", xSplit: 2, ySplit: 4 }],
    });

    // Column layout:
    // | # | Team | Track | Submitted? | <fields...> | <crits...> | Weighted | Pts | Feedback | Notes |
    const fixedCols = 4;
    const fieldCount = phaseFields.length;
    const critCount = scoringCriteria.length;
    const firstFieldCol = fixedCols + 1;
    const firstCritCol = fixedCols + fieldCount + 1;
    const lastCritCol = firstCritCol + critCount - 1;
    const totalCol = lastCritCol + 1;
    const scaledCol = lastCritCol + 2;
    const feedbackCol = lastCritCol + 3;
    const notesCol = lastCritCol + 4;
    const colCount = notesCol;

    ws.columns = [
      { width: 4 },        // #
      { width: 28 },       // Team
      { width: 22 },       // Track
      { width: 12 },       // Submitted?
      ...phaseFields.map((f) => ({ width: fieldColumnWidth(f) })),
      ...scoringCriteria.map((c) => ({ width: Math.max(14, Math.min(28, c.name.length + 4)) })),
      { width: 14 },       // Weighted (0-100)
      { width: 12 },       // Phase Points
      { width: 48 },       // Feedback
      { width: 40 },       // Notes
    ];

    // Row 1 — Title
    const titleRow = ws.addRow([`${contest.name} — ${T.phase} ${phase.phase}: ${phase.name} (${phase.maxPoints} pts)`]);
    titleRow.font = { bold: true, size: 14, color: { argb: C_HEADER_FG } };
    ws.mergeCells(1, 1, 1, colCount);
    titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_HEADER_BG } };
    titleRow.height = 26;
    titleRow.alignment = { vertical: "middle", indent: 1 };

    // Row 2 — subtitle with judge + weights / formula hints
    const subtitle = ws.addRow([
      `${T.judge}: ${judgeName}`,
      ...Array(fixedCols + fieldCount - 1).fill(""),
      ...scoringCriteria.map((c) => `weight ${c.weight}`),
      "weighted 0-100",
      "scaled pts",
      `visible to ${T.team.toLowerCase()}`,
      "private",
    ]);
    subtitle.font = { color: { argb: "FFBBBBBB" }, italic: true };
    subtitle.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_SUBHEADER_BG } };
    subtitle.getCell(1).font = { color: { argb: C_HEADER_FG }, italic: true };
    ws.mergeCells(2, 1, 2, fixedCols + fieldCount);
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
      "#", T.team, T.track, "Submitted?",
      ...phaseFields.map((f) => f.label),
      ...scoringCriteria.map((c) => `${c.name} (${scale.min}-${scale.max})`),
      "Weighted 0-100", `${T.phase} Pts`, `Feedback to ${T.team.toLowerCase()}`, "Notes",
    ]);
    header.font = { bold: true, color: { argb: C_HEADER_FG } };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_HEADER_BG } };
      cell.border = { bottom: { style: "medium", color: { argb: "FF7C3AED" } } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });

    const weightsArray = `{${scoringCriteria.map((c) => Number(c.weight) || 0).join(",")}}`;

    // Data rows
    approvedTeams.forEach((team, idx) => {
      const submission = teamSubmissions.find(
        (s) => s.teamId === team.id && s.phase === phase.phase,
      );
      const values = submission ? submissionValues(submission) : {};
      const mine = submission ? myScoreBySubmission.get(submission.id) : undefined;
      const myCriteria = (mine?.criteriaScores ?? null) as Record<string, number> | null;

      const row = ws.addRow([
        idx + 1,
        team.name,
        team.trackRef?.name ?? team.track ?? "",
        submission ? "Yes" : "—",
        ...phaseFields.map(() => ""),              // filled below (links need rich values)
        ...scoringCriteria.map((c) => {
          const v = myCriteria?.[c.key];
          return typeof v === "number" ? v : null;  // blank score cells for the judge to fill
        }),
        null,                                       // weighted total (formula)
        null,                                       // scaled phase pts (formula)
        mine?.feedback ?? "",                       // feedback
        "",                                         // notes
      ]);

      // Submission field cells
      phaseFields.forEach((f, i) => {
        const cell = row.getCell(firstFieldCol + i);
        const raw = values[f.key];
        const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((x) => typeof x === "string" && x.trim());
        if (list.length === 0) {
          cell.value = "";
          return;
        }
        if (isLinkField(f)) {
          const text = list.length === 1 ? absolute(list[0]) : list.map(absolute).join("\n");
          cell.value = { text: truncate(text, 2000), hyperlink: absolute(list[0]) };
          cell.font = { color: { argb: C_LINK }, underline: true };
          if (list.length > 1) cell.note = `${list.length} links — the cell opens the first one.`;
        } else if (f.type === "agentCharter") {
          cell.value = truncate(displayValue(f, raw));
        } else {
          cell.value = truncate(list.join("\n"));
        }
        cell.alignment = { vertical: "top", wrapText: true };
      });

      // Score cells: editable visual (light yellow), validation on the scale
      for (let c = firstCritCol; c <= lastCritCol; c++) {
        const cell = row.getCell(c);
        cell.numFmt = wholeSteps ? "0" : "0.0#";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_EDITABLE_BG } };
        cell.alignment = { horizontal: "center" };
        cell.dataValidation = {
          type: wholeSteps ? "whole" : "decimal",
          operator: "between",
          allowBlank: true,
          formulae: [scale.min, scale.max],
          showErrorMessage: true,
          errorTitle: "Invalid score",
          error: `Scores must be ${wholeSteps ? "whole numbers" : "numbers"} between ${scale.min} and ${scale.max}.`,
        };
      }

      // Weighted total (0-100) = SUMPRODUCT(weights, (score - min)/(max - min) * nonBlank) / SUM(weights) * 100
      const scoresRange = `${ws.getCell(row.number, firstCritCol).address}:${ws.getCell(row.number, lastCritCol).address}`;
      const weightedFormula =
        `SUMPRODUCT(${weightsArray},((${scoresRange}-${scale.min})/${span})*(${scoresRange}<>""))/${totalWeight}*100`;
      // Cached result mirrors the formula so viewers that don't recalc still show the right number.
      const cachedWeighted = scoringCriteria.reduce((sum, c) => {
        const v = myCriteria?.[c.key];
        if (typeof v !== "number") return sum;
        return sum + (Number(c.weight) || 0) * ((v - scale.min) / span);
      }, 0) / totalWeight * 100;

      row.getCell(totalCol).value = { formula: weightedFormula, result: cachedWeighted };
      row.getCell(totalCol).numFmt = "0.0";
      row.getCell(totalCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_FORMULA_BG } };
      row.getCell(totalCol).font = { bold: true };
      row.getCell(totalCol).alignment = { horizontal: "center" };

      // Scaled to phase max points
      row.getCell(scaledCol).value = {
        formula: `${ws.getCell(row.number, totalCol).address}/100*${phase.maxPoints}`,
        result: (cachedWeighted / 100) * phase.maxPoints,
      };
      row.getCell(scaledCol).numFmt = "0.0";
      row.getCell(scaledCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_FORMULA_BG } };
      row.getCell(scaledCol).alignment = { horizontal: "center" };

      row.getCell(feedbackCol).alignment = { vertical: "top", wrapText: true };
      row.getCell(feedbackCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_EDITABLE_BG } };
      row.getCell(notesCol).alignment = { vertical: "top", wrapText: true };

      // Alternating row banding in the fixed, non-editable columns for readability.
      if (idx % 2 === 0) {
        for (let c = 1; c <= fixedCols; c++) {
          row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_ROW_ALT } };
        }
      }
    });

    // Summary row: count of submitted / not submitted
    const summaryRowNum = ws.lastRow!.number + 2;
    const summary = ws.getRow(summaryRowNum);
    summary.getCell(2).value = `${termPlural(terminology, "team")} total:`;
    summary.getCell(3).value = approvedTeams.length;
    summary.getCell(4).value = "Submitted:";
    summary.getCell(5).value = {
      formula: `COUNTIF(D5:D${approvedTeams.length + 4},"Yes")`,
      result: approvedTeams.filter((t) => teamSubmissions.some((s) => s.teamId === t.id && s.phase === phase.phase)).length,
    };
    summary.font = { italic: true, color: { argb: "FF555555" } };

    // Rubric hint next to the summary (e.g. "9-10 Exceptional · 7-8 Strong")
    if (scale.labels && scale.labels.length > 0) {
      const rubric = ws.getRow(summaryRowNum + 1);
      rubric.getCell(2).value = [...scale.labels]
        .sort((a, b) => b.min - a.min)
        .map((l) => `${l.min === l.max ? l.min : `${l.min}-${l.max}`} ${l.label}`)
        .join(" · ");
      rubric.font = { italic: true, color: { argb: "FF555555" } };
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
