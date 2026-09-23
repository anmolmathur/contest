/**
 * AI driver. Two modes:
 *
 *   OpenAI mode (production): OPENAI_API_KEY present. Streams responses
 *     using the OpenAI Node SDK's chat.completions.create({ stream: true }).
 *     Model: OPENAI_MODEL (default gpt-4o-mini).
 *
 *   Mock mode (local dev): returns a deterministic canned response chunked
 *     out over a few hundred milliseconds so the UI streaming still works.
 *     Triggered when OPENAI_API_KEY is unset OR AI_DRIVER=mock. Callers may
 *     pass `mockReply` to make the offline answer contest-aware.
 *
 * The caller is responsible for composing the system prompt. We only handle
 * generation + streaming. For JSON (non-streaming) calls see lib/ai/json.ts.
 */

import OpenAI from "openai";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatStreamHandler = (chunk: string) => void;

export function isMockMode(): boolean {
  return !process.env.OPENAI_API_KEY || process.env.AI_DRIVER === "mock";
}

export function aiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export async function streamChat(
  messages: ChatMessage[],
  onChunk: ChatStreamHandler,
  opts?: { model?: string; temperature?: number; maxTokens?: number; mockReply?: string },
): Promise<void> {
  if (isMockMode()) return streamMock(messages, onChunk, opts?.mockReply);
  return streamOpenAI(messages, onChunk, opts);
}

/** Stream a fixed string in small chunks (used for mock mode and canned refusals). */
export async function streamText(text: string, onChunk: ChatStreamHandler, delayMs = 30): Promise<void> {
  for (const piece of text.match(/[\s\S]{1,40}/g) ?? [text]) {
    onChunk(piece);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function streamMock(messages: ChatMessage[], onChunk: ChatStreamHandler, mockReply?: string): Promise<void> {
  if (mockReply) return streamText(mockReply, onChunk);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const q = (lastUser?.content ?? "").trim();
  const reply = q
    ? `(mock assistant) Based on the contest rules I have in context, here's what I can share about your question "${q.slice(0, 120)}":\n\n• This is a mock reply — no OpenAI key is configured yet.\n• In production, the assistant will pull from rulesContent, FAQ and phaseConfig for this contest.\n• To switch on real AI, set OPENAI_API_KEY in .env.`
    : "(mock assistant) Hi! Ask me anything about this contest — rules, phases, deliverables, scoring.";
  return streamText(reply, onChunk, 40);
}

async function streamOpenAI(
  messages: ChatMessage[],
  onChunk: ChatStreamHandler,
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<void> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = await client.chat.completions.create({
    model: opts?.model ?? aiModel(),
    temperature: opts?.temperature ?? 0.3,
    ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    stream: true,
    messages,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) onChunk(delta);
  }
}
