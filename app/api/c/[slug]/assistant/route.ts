import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { resolveContest } from "@/lib/contest-auth";
import { streamChat, type ChatMessage } from "@/lib/ai/openai";

export const runtime = "nodejs";

const RATE_LIMIT = new Map<string, { count: number; windowStart: number }>();
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30; // 30 msgs/min/user

function rateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = RATE_LIMIT.get(userId);
  if (!bucket || now - bucket.windowStart > RL_WINDOW_MS) {
    RATE_LIMIT.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= RL_MAX) return false;
  bucket.count++;
  return true;
}

/**
 * Build the system prompt for the assistant. Everything contest-specific
 * is injected per-request — rules, FAQ, phases — so the same contest code
 * serves any tenant without recompilation.
 */
function buildSystemPrompt(contest: {
  name: string;
  description: string | null;
  rulesContent: string | null;
  eligibilityRules: string | null;
  teamStructureRules: string | null;
  deliverableRules: string | null;
  phaseConfig: unknown;
  faqConfig: unknown;
  prizes: unknown;
}): string {
  const sections: string[] = [];
  sections.push(
    `You are the official assistant for the "${contest.name}" contest.`,
    "Your job is to answer questions about the contest rules, phases, deliverables, scoring, and FAQ.",
    "If a question is not answered by the material below, say so clearly and suggest contacting the organizers.",
    "Be concise. Cite specific rule or FAQ lines when relevant.",
  );
  if (contest.description) sections.push(`\n# About\n${contest.description}`);
  if (contest.rulesContent) sections.push(`\n# Rules\n${contest.rulesContent}`);
  if (contest.eligibilityRules) sections.push(`\n# Eligibility\n${contest.eligibilityRules}`);
  if (contest.teamStructureRules) sections.push(`\n# Team structure\n${contest.teamStructureRules}`);
  if (contest.deliverableRules) sections.push(`\n# Deliverables\n${contest.deliverableRules}`);
  if (Array.isArray(contest.phaseConfig)) {
    sections.push(
      `\n# Phases\n` +
        (contest.phaseConfig as Array<Record<string, unknown>>)
          .map(
            (p) =>
              `## Phase ${p.phase}: ${p.name} (${p.maxPoints ?? 0} pts)\n` +
              `${p.description ?? ""}\n` +
              (Array.isArray(p.deliverables) ? `Deliverables: ${(p.deliverables as string[]).join("; ")}` : ""),
          )
          .join("\n\n"),
    );
  }
  if (Array.isArray(contest.faqConfig)) {
    sections.push(
      `\n# FAQ\n` +
        (contest.faqConfig as Array<{ question: string; answer: string }>)
          .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
          .join("\n\n"),
    );
  }
  if (Array.isArray(contest.prizes)) {
    sections.push(
      `\n# Prizes\n` +
        (contest.prizes as Array<Record<string, unknown>>)
          .map((p) => `- ${p.label ?? p.rank}${p.amount ? ` — ${p.amount}` : ""}`)
          .join("\n"),
    );
  }
  return sections.join("\n");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  if (!rateLimit(session.user.id)) return new Response("Too many requests", { status: 429 });

  const { slug } = await params;
  const contest = await resolveContest(slug);
  if (!contest) return new Response("Contest not found", { status: 404 });

  const body = await req.json();
  const history = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const userMessages = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-20);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(contest) },
    ...userMessages,
  ];

  // Stream response as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamChat(messages, (chunk) => {
          const data = JSON.stringify({ delta: chunk });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        });
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "AI error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
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
