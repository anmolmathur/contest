/**
 * POST /api/c/[slug]/assistant — Contest Assistant, CONTESTANT mode.
 *
 * Answers visitors' and participants' questions ABOUT the contest (rules,
 * eligibility, dates, rounds, deliverables, scoring, categories, agenda,
 * prizes, FAQ). It never helps execute the contest (no writing entries, no
 * judging, no predictions, no other teams' data, no actions).
 *
 * Request:  { messages: { role: "user" | "assistant", content: string }[] }
 * Response: text/event-stream of `data: {"delta": "..."}` chunks, then
 *           `data: [DONE]`; errors mid-stream as `data: {"error": "..."}`.
 *
 * Access: anonymous allowed (middleware lets POST through) with an IP rate
 * limit; signed-in users get a per-user limit. Disabled when
 * settings.assistantEnabled === false. Draft contests: admins only.
 */
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { canAdminContest } from "@/lib/contest-auth";
import { resolveSettings } from "@/lib/contest-config";
import { streamChat, streamText, type ChatMessage } from "@/lib/ai/openai";
import { checkRateLimits, clientIp } from "@/lib/ai/rate-limit";
import { detectOutOfScope } from "@/lib/ai/guardrails";
import { buildContestantSystemPrompt, mockContestAnswer } from "@/lib/ai/contest-knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

const USER_LIMITS = [
  { max: 30, windowMs: 60_000 },
  { max: 300, windowMs: 3_600_000 },
];
const ANON_LIMITS = [
  { max: 10, windowMs: 60_000 },
  { max: 60, windowMs: 3_600_000 },
];

const MAX_MSG_CHARS = 2000;
const MAX_HISTORY = 12;

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const allowed = userId
    ? checkRateLimits(`assistant:u:${userId}`, USER_LIMITS)
    : checkRateLimits(`assistant:ip:${clientIp(req)}`, ANON_LIMITS);
  if (!allowed) return json(429, "Too many questions — please wait a minute and try again.");

  const { slug } = await params;
  const contest = await db.query.contests.findFirst({
    where: eq(contests.slug, slug),
    with: { tracks: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
  });
  if (!contest) return json(404, "Contest not found");

  if (!resolveSettings(contest.settings).assistantEnabled) {
    return json(403, "The assistant is turned off for this contest.");
  }
  if (contest.status === "draft") {
    if (!userId || !(await canAdminContest(userId, contest.id))) {
      return json(403, "The assistant is not available for this contest yet.");
    }
  }

  let body: { messages?: unknown };
  try {
    body = (await req.json()) as { messages?: unknown };
  } catch {
    return json(400, "Invalid JSON body");
  }
  const history: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        typeof m === "object" &&
        ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_CHARS) }))
    .filter((m) => m.content.trim())
    .slice(-MAX_HISTORY);
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (!lastUser || history[history.length - 1] !== lastUser) return json(400, "The last message must be a question.");

  const knowledge = {
    ...contest,
    tracks: contest.tracks.map((t) => ({ name: t.name, description: t.description })),
  };
  const today = new Date().toISOString().slice(0, 10);
  const refusal = detectOutOfScope(lastUser.content, "contestant");
  const messages: ChatMessage[] = [{ role: "system", content: buildContestantSystemPrompt(knowledge, today) }, ...history];

  const encoder = new TextEncoder();
  // The client may disconnect mid-stream (closed widget, navigation); stop
  // writing instead of throwing "Controller is already closed".
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          closed = true;
        }
      };
      const send = (chunk: string) => write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      try {
        if (refusal) {
          await streamText(refusal.reply, send, 0);
        } else {
          await streamChat(messages, send, {
            temperature: 0.2,
            maxTokens: 800,
            mockReply: mockContestAnswer(knowledge, lastUser.content),
          });
        }
        write(`data: [DONE]\n\n`);
      } catch (e) {
        if (!closed) console.error("[assistant] streaming error:", e);
        write(`data: ${JSON.stringify({ error: "The assistant is unavailable right now. Please try again." })}\n\n`);
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
