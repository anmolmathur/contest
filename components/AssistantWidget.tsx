"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Loader2, RotateCcw } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const DEFAULT_SUGGESTIONS = [
  "Who can participate?",
  "What do we need to submit in each round?",
  "How is the scoring done?",
];

/**
 * Floating "Ask about this contest" assistant (contestant mode). Streams SSE
 * from /api/c/[slug]/assistant. Answers questions ABOUT the contest only —
 * it does not write entries, judge, or predict results.
 *
 * Works for anonymous visitors too (the API rate-limits by IP).
 * Full-width bottom sheet under 640px, floating panel above.
 */
export function AssistantWidget({
  contestSlug,
  contestName,
  suggestions,
}: {
  contestSlug: string;
  contestName?: string;
  /** Up to 3 suggested questions shown before the first message. */
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const chips = (suggestions && suggestions.length ? suggestions : DEFAULT_SUGGESTIONS).slice(0, 3);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function setLast(update: (m: Msg) => Msg) {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = update(copy[copy.length - 1]);
      return copy;
    });
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || sending) return;
    setInput("");
    const history = messages.filter((m) => !m.error && m.content.trim());
    const outgoing: Msg[] = [...history, { role: "user", content: q }];
    setMessages([...outgoing, { role: "assistant", content: "" }]);
    setSending(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`/api/c/${encodeURIComponent(contestSlug)}/assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: outgoing.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `Something went wrong (${res.status}).`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          if (res.status === 429) msg = "Too many questions — please wait a minute and try again.";
        }
        setLast(() => ({ role: "assistant", content: msg, error: true }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const obj = JSON.parse(raw) as { delta?: string; error?: string };
            if (obj.error) {
              setLast(() => ({ role: "assistant", content: obj.error!, error: true }));
            } else if (obj.delta) {
              setLast((m) => ({ ...m, content: m.content + obj.delta! }));
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setLast(() => ({ role: "assistant", content: "Network error — please try again.", error: true }));
      }
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask about this contest"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-purple to-electric-blue px-4 py-3 text-sm font-medium text-white shadow-lg shadow-purple-900/40 transition hover:brightness-110 sm:bottom-6 sm:right-6"
      >
        <Sparkles size={16} /> <span>Ask about this contest</span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Contest assistant"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b0b12]/95 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:max-h-[calc(100dvh-3rem)] sm:w-96 sm:rounded-xl"
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
            <Sparkles size={14} className="text-purple-300" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">Ask about this contest</div>
            {contestName && <div className="truncate text-xs text-gray-400">{contestName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              title="Start over"
              className="rounded-md p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <RotateCcw size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="rounded-md p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Hi! Ask me about eligibility, dates, rounds, what to submit, scoring, categories or prizes.
            </p>
            <div className="flex flex-col items-start gap-2">
              {chips.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-left text-xs text-purple-100 transition hover:border-purple-400/60 hover:bg-purple-500/20"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto max-w-[85%] bg-purple-600 text-white"
                : m.error
                  ? "max-w-[90%] border border-red-500/30 bg-red-500/10 text-red-200"
                  : "max-w-[90%] bg-white/5 text-gray-100"
            }`}
          >
            {m.content || (sending && i === messages.length - 1 ? <Loader2 size={14} className="animate-spin" /> : "")}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder="Type a question..."
            aria-label="Your question"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-purple-500 sm:text-sm"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send"
            className="rounded-md bg-purple-600 p-2 text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-gray-500">Answers questions about this contest only.</p>
      </footer>
    </div>
  );
}
