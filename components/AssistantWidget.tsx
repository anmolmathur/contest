"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Floating chat bubble. Uses SSE on /api/c/[slug]/assistant for streaming.
 * Pass `contestSlug` so the widget knows which contest's rules/FAQ to query.
 */
export function AssistantWidget({ contestSlug }: { contestSlug: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: q }, { role: "assistant", content: "" }];
    setMessages(next);
    setSending(true);

    const res = await fetch(`/api/c/${contestSlug}/assistant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: next.slice(0, -1) }),
    });
    if (!res.ok || !res.body) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `Error: ${res.status}` };
        return copy;
      });
      setSending(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
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
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: "assistant", content: `Error: ${obj.error}` };
              return copy;
            });
          } else if (obj.delta) {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + obj.delta! };
              return copy;
            });
          }
        } catch {
          // ignore malformed lines
        }
      }
    }
    setSending(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-purple-500"
      >
        <Sparkles size={16} /> Ask about this contest
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[540px] w-96 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          <div className="text-sm font-medium text-white">Contest Assistant</div>
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="text-sm text-slate-400">
            Ask me about rules, phases, deliverables, scoring, or anything in the FAQ.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user" ? "ml-auto max-w-[80%] bg-purple-600 text-white" : "max-w-[90%] bg-white/5 text-slate-100"
            }`}
          >
            {m.content || (sending && i === messages.length - 1 ? <Loader2 size={14} className="animate-spin" /> : "")}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <footer className="border-t border-white/10 px-3 py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a question..."
            className="flex-1 rounded-md bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="rounded-md bg-purple-600 p-2 text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </footer>
    </div>
  );
}
