/**
 * Non-streaming JSON completion helper (OpenAI chat.completions with
 * response_format json_object). Falls back to a caller-supplied deterministic
 * mock when OPENAI_API_KEY is unset or AI_DRIVER=mock.
 */
import OpenAI from "openai";
import { aiModel, isMockMode, type ChatMessage } from "@/lib/ai/openai";

export class AiJsonError extends Error {}

export async function completeJson<T>(
  messages: ChatMessage[],
  opts: {
    /** Deterministic offline result. */
    mock: () => T | Promise<T>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<{ data: unknown; mock: boolean }> {
  if (isMockMode()) {
    return { data: await opts.mock(), mock: true };
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: opts.model ?? aiModel(),
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 6000,
    response_format: { type: "json_object" },
    messages,
  });
  const content = res.choices[0]?.message?.content ?? "";
  if (res.choices[0]?.finish_reason === "length") {
    throw new AiJsonError("The AI response was too long and got cut off. Try asking for a smaller change.");
  }
  try {
    return { data: JSON.parse(content), mock: false };
  } catch {
    throw new AiJsonError("The AI returned malformed JSON. Please try again.");
  }
}
