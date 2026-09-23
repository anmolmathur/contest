/**
 * POST /api/ai/contest-setup — Contest Assistant, SETUP mode.
 *
 * Turns an admin's plain-language brief (+ follow-up chat) into a contest
 * configuration DRAFT. It never writes to the database: the admin reviews the
 * draft in the UI and applies it to the create/edit form, which then saves via
 * POST /api/contests or PUT /api/contests/[slug].
 *
 * Request:  { mode: "create" | "edit", contestSlug?: string,
 *             messages: { role: "user" | "assistant", content: string }[],
 *             draft?: ContestDraft | null }          // working draft / pending patch, for refinement
 * Response: { reply: string, draft: ContestDraft | null, warnings: string[],
 *             outOfScope: boolean, mock: boolean }
 * Errors:   { error } with 400 / 401 / 403 / 404 / 429 / 502
 *
 * Auth: create → platform admin; edit → contest admin (canAdminContest).
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { canAdminContest, isPlatformAdmin } from "@/lib/contest-auth";
import type { ChatMessage } from "@/lib/ai/openai";
import { AiJsonError, completeJson } from "@/lib/ai/json";
import { checkRateLimits } from "@/lib/ai/rate-limit";
import { detectOutOfScope } from "@/lib/ai/guardrails";
import { buildSetupSystemPrompt, mockCreateDraft, mockEditPatch } from "@/lib/ai/contest-setup";
import { SLUG_RE, sanitizeDraft, slugify, str, type ContestDraft, type SanitizeContext } from "@/lib/ai/contest-draft";

export const runtime = "nodejs";
export const maxDuration = 60;

const LIMITS = [
  { max: 10, windowMs: 60_000 },
  { max: 80, windowMs: 3_600_000 },
];

type InMsg = { role: "user" | "assistant"; content: string };

function cleanMessages(raw: unknown): InMsg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is { role: string; content: unknown } => !!m && typeof m === "object" && "role" in m)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as InMsg["role"], content: str(m.content, 4000) ?? "" }))
    .filter((m) => m.content)
    .slice(-16);
}

/** Current config sent to the model in edit mode (no execution state, no teams). */
function currentConfig(c: typeof contests.$inferSelect & { tracks: Array<{ name: string; description: string | null; icon: string | null }> }) {
  const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const settings = (c.settings && typeof c.settings === "object" ? { ...(c.settings as Record<string, unknown>) } : {}) as Record<
    string,
    unknown
  >;
  delete settings.resultsPublished;
  return {
    contestType: c.contestType,
    name: c.name,
    slug: c.slug,
    status: c.status,
    description: c.description,
    heroTitle: c.heroTitle,
    heroSubtitle: c.heroSubtitle,
    heroCtaText: c.heroCtaText,
    rulesContent: c.rulesContent,
    eligibilityRules: c.eligibilityRules,
    teamStructureRules: c.teamStructureRules,
    deliverableRules: c.deliverableRules,
    startDate: dateOnly(c.startDate),
    endDate: dateOnly(c.endDate),
    registrationDeadline: dateOnly(c.registrationDeadline),
    maxTeams: c.maxTeams,
    maxApprovedTeams: c.maxApprovedTeams,
    maxTeamMembers: c.maxTeamMembers,
    supportEmail: c.supportEmail,
    tracks: c.tracks.map((t) => ({ name: t.name, description: t.description ?? "", ...(t.icon ? { icon: t.icon } : {}) })),
    phaseConfig: c.phaseConfig,
    scoringCriteria: c.scoringCriteria,
    scoringScale: c.scoringScale,
    submissionFields: c.submissionFields,
    terminology: c.terminology,
    roleConfig: c.roleConfig,
    prizes: c.prizes,
    faqConfig: c.faqConfig,
    agenda: c.agenda,
    speakers: c.speakers,
    settings,
  };
}

/** Suggest a free slug: base, base-2, base-3 … (excluding the contest being edited). */
async function freeSlug(base: string, exceptId?: string): Promise<string> {
  const root = base.slice(0, 54) || "contest";
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const hit = await db.query.contests.findFirst({ where: eq(contests.slug, candidate), columns: { id: true } });
    if (!hit || hit.id === exceptId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode === "edit" ? "edit" : body.mode === "create" ? "create" : null;
  if (!mode) return NextResponse.json({ error: 'mode must be "create" or "edit"' }, { status: 400 });

  // ---- auth ---------------------------------------------------------------
  let contest: Awaited<ReturnType<typeof loadContest>> = null;
  if (mode === "create") {
    if (!(await isPlatformAdmin(userId))) {
      return NextResponse.json({ error: "Only platform admins can create contests" }, { status: 403 });
    }
  } else {
    const slug = typeof body.contestSlug === "string" ? body.contestSlug : "";
    if (!slug) return NextResponse.json({ error: "contestSlug is required in edit mode" }, { status: 400 });
    contest = await loadContest(slug);
    if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    if (!(await canAdminContest(userId, contest.id))) {
      return NextResponse.json({ error: "Only contest admins can use the setup assistant" }, { status: 403 });
    }
  }

  if (!checkRateLimits(`setup:u:${userId}`, LIMITS)) {
    return NextResponse.json({ error: "Too many requests — please wait a minute and try again." }, { status: 429 });
  }

  const messages = cleanMessages(body.messages);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "Send at least one user message" }, { status: 400 });

  // ---- scope pre-filter ---------------------------------------------------
  const verdict = detectOutOfScope(lastUser.content, "setup");
  if (verdict) {
    return NextResponse.json({ reply: verdict.reply, draft: null, warnings: [], outOfScope: true, mock: false });
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const current = contest ? currentConfig(contest) : null;
  // Raw values for validation/merging (settings keep every stored key so a PUT never drops them).
  const sanitizeCtx: SanitizeContext = {
    mode,
    current: contest
      ? {
          phaseConfig: contest.phaseConfig,
          speakers: contest.speakers,
          settings: contest.settings,
          terminology: contest.terminology,
        }
      : undefined,
  };
  const workingDraft =
    body.draft && typeof body.draft === "object" && !Array.isArray(body.draft)
      ? sanitizeDraft(body.draft, sanitizeCtx).draft
      : null;

  const system = buildSetupSystemPrompt({ mode, today: todayStr, current, workingDraft });
  const chat: ChatMessage[] = [{ role: "system", content: system }, ...messages];

  let raw: unknown;
  let mock = false;
  try {
    const res = await completeJson(chat, {
      temperature: 0.3,
      mock: () => {
        if (mode === "create") {
          const brief = messages.filter((m) => m.role === "user").map((m) => m.content).join(". ");
          return mockCreateDraft(brief, new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));
        }
        const m = mockEditPatch(lastUser.content, (current ?? {}) as Record<string, unknown>);
        // Combine with the pending patch, like the real model is asked to.
        return m.draft && workingDraft ? { ...m, draft: { ...workingDraft, ...m.draft } } : m;
      },
    });
    raw = res.data;
    mock = res.mock;
  } catch (e) {
    console.error("[ai/contest-setup] model error:", e);
    const msg = e instanceof AiJsonError ? e.message : "The AI service is unavailable right now. Please try again.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // ---- validate model output ---------------------------------------------
  const out = normaliseModelOutput(raw);
  const reply =
    str(out.reply, 2000) ??
    (out.draft ? "Here's a draft — review it and apply it to the form." : "Could you tell me a bit more about the contest?");
  const outOfScope = out.outOfScope === true;

  let draft: ContestDraft | null = null;
  let warnings: string[] = [];
  if (!outOfScope && out.draft && typeof out.draft === "object" && !Array.isArray(out.draft)) {
    const merged =
      mode === "edit" && contest
        ? mergePartialLists(out.draft as Record<string, unknown>, contest)
        : { draft: out.draft as Record<string, unknown>, notes: [] as string[] };
    const res = sanitizeDraft(merged.draft, sanitizeCtx);
    draft = res.draft;
    warnings = [...merged.notes, ...res.warnings];

    // Slug: valid format + suggest a free one.
    if (mode === "create") {
      const base = draft.slug && SLUG_RE.test(draft.slug) ? draft.slug : slugify(draft.name ?? "") || "contest";
      const free = await freeSlug(base);
      if (free !== base) warnings.push(`Slug "${base}" is taken — suggested "${free}".`);
      draft.slug = free;
    } else if (draft.slug !== undefined && contest) {
      if (draft.slug === contest.slug) delete draft.slug;
      else {
        const base = SLUG_RE.test(draft.slug) ? draft.slug : slugify(draft.slug);
        const free = await freeSlug(base, contest.id);
        if (free !== base) warnings.push(`Slug "${base}" is taken — suggested "${free}".`);
        draft.slug = free;
      }
    }
    if (Object.keys(draft).length === 0) draft = null;
  }

  return NextResponse.json({ reply, draft, warnings, outOfScope, mock });
}

async function loadContest(slug: string) {
  const c = await db.query.contests.findFirst({
    where: eq(contests.slug, slug),
    with: { tracks: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
  });
  return c ?? null;
}

// Models occasionally wrap the answer ({"response": {...}}) or return the
// draft/patch at the top level instead of under "draft". Accept those shapes.
const DRAFT_KEYS = new Set([
  "contestType", "name", "slug", "description", "heroTitle", "heroSubtitle", "heroCtaText", "supportEmail",
  "rulesContent", "eligibilityRules", "teamStructureRules", "deliverableRules", "startDate", "endDate",
  "registrationDeadline", "maxTeams", "maxApprovedTeams", "maxTeamMembers", "tracks", "phaseConfig",
  "scoringCriteria", "scoringScale", "submissionFields", "terminology", "roleConfig", "prizes", "faqConfig",
  "agenda", "speakers", "settings",
]);

function normaliseModelOutput(raw: unknown): Record<string, unknown> {
  let out = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  if (!("reply" in out) && !("draft" in out)) {
    const inner = Object.values(out).find(
      (v) => v && typeof v === "object" && !Array.isArray(v) && ("reply" in (v as object) || "draft" in (v as object)),
    );
    if (inner) out = inner as Record<string, unknown>;
  }
  if (!out.draft || typeof out.draft !== "object") {
    const topLevel = Object.fromEntries(Object.entries(out).filter(([k]) => DRAFT_KEYS.has(k)));
    if (Object.keys(topLevel).length > 0) out = { ...out, draft: topLevel };
  }
  if (!("reply" in out) && !out.draft) {
    console.warn("[ai/contest-setup] unexpected model output keys:", Object.keys(out).slice(0, 20));
  }
  return out;
}

// In edit mode the model sometimes returns only the changed items of a list
// (e.g. just the finale round) even though it is asked for the full list.
// Applying that as-is would silently drop the other items, so a list SHORTER
// than the stored one is merged into it by key: matching items are replaced,
// new ones appended. (Removing items is done in the form, not via AI.)
const LIST_KEYS: Record<string, (x: Record<string, unknown>) => string | undefined> = {
  phaseConfig: (x) => (x.phase != null ? String(x.phase) : undefined),
  scoringCriteria: (x) => (x.key as string) ?? (x.name as string),
  submissionFields: (x) => x.key as string,
  roleConfig: (x) => x.role as string,
  prizes: (x) => (x.rank != null ? String(x.rank) : undefined),
  faqConfig: (x) => (typeof x.question === "string" ? x.question.trim().toLowerCase() : undefined),
  agenda: (x) => x.id as string,
  speakers: (x) => x.id as string,
  tracks: (x) => (typeof x.name === "string" ? x.name.trim().toLowerCase() : undefined),
};

function mergePartialLists(
  draft: Record<string, unknown>,
  contest: Record<string, unknown> & { tracks?: Array<{ name: string; description: string | null; icon: string | null }> },
): { draft: Record<string, unknown>; notes: string[] } {
  const out = { ...draft };
  const notes: string[] = [];
  for (const [field, keyOf] of Object.entries(LIST_KEYS)) {
    const next = draft[field];
    const stored = field === "tracks" ? contest.tracks : contest[field];
    if (!Array.isArray(next) || !Array.isArray(stored) || next.length >= stored.length) continue;
    const merged = (stored as Array<Record<string, unknown>>).map((x) => ({ ...x }));
    let replaced = 0;
    let added = 0;
    for (const item of next as Array<Record<string, unknown>>) {
      const k = item && typeof item === "object" ? keyOf(item) : undefined;
      const idx = k === undefined ? -1 : merged.findIndex((m) => keyOf(m) === k);
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...item };
        replaced++;
      } else {
        merged.push(item);
        added++;
      }
    }
    out[field] = merged;
    notes.push(`Merged the suggested ${field} changes into the existing list (${replaced} updated, ${added} added).`);
  }
  return { draft: out, notes };
}

