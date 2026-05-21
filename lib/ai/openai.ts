/**
 * AI driver. Two modes:
 *
 *   OpenAI mode (production): OPENAI_API_KEY present. Streams responses
 *     using the OpenAI Node SDK's chat.completions.stream().
 *
 *   Mock mode (local dev): returns a deterministic canned response chunked
 *     out over a few hundred milliseconds so the UI streaming still works.
 *     Triggered when OPENAI_API_KEY is unset OR AI_DRIVER=mock.
 *
 * The caller is responsible for composing the system prompt from the
 * contest's rules/FAQ/phase config. We only handle generation + streaming.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatStreamHandler = (chunk: string) => void;

export async function streamChat(
  messages: ChatMessage[],
  onChunk: ChatStreamHandler,
  opts?: { model?: string; temperature?: number },
): Promise<void> {
  const useMock = !process.env.OPENAI_API_KEY || process.env.AI_DRIVER === "mock";
  if (useMock) return streamMock(messages, onChunk);
  return streamOpenAI(messages, onChunk, opts);
}

async function streamMock(messages: ChatMessage[], onChunk: ChatStreamHandler): Promise<void> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const q = (lastUser?.content ?? "").trim();
  const reply = q
    ? `(mock assistant) Based on the contest rules I have in context, here's what I can share about your question "${q.slice(0, 120)}":\n\n• This is a mock reply — no OpenAI key is configured yet.\n• In production, the assistant will pull from rulesContent, FAQ and phaseConfig for this contest.\n• To switch on real AI, set OPENAI_API_KEY in .env.`
    : "(mock assistant) Hi! Ask me anything about this contest — rules, phases, deliverables, scoring.";
  for (const piece of reply.match(/.{1,40}/g) ?? [reply]) {
    onChunk(piece);
    await new Promise((r) => setTimeout(r, 40));
  }
}

async function streamOpenAI(
  messages: ChatMessage[],
  onChunk: ChatStreamHandler,
  opts?: { model?: string; temperature?: number },
): Promise<void> {
  // Dynamic import so `openai` is only loaded when configured.
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = await client.chat.completions.create({
    model: opts?.model ?? "gpt-4o-mini",
    temperature: opts?.temperature ?? 0.3,
    stream: true,
    messages,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) onChunk(delta);
  }
}
