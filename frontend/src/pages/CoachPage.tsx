import { type FormEvent, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { fetchChatHistory, requestWeeklyCheckin, sendChatMessage } from "../api/chat";
import ToolResultCard from "../components/ToolResultCard";
import type { ChatMessage } from "../types/chat";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function describeError(err: unknown, fallback: string): string {
  if (!isAxiosError<{ detail?: string }>(err)) return fallback;
  // 502 means the configured LLM provider itself failed (bad/missing key,
  // network issue, model not pulled) — surface a plain-language cause
  // instead of the raw provider error text.
  if (err.response?.status === 502) {
    return "The AI coach is temporarily unavailable — check that an LLM provider is configured (see backend/.env).";
  }
  return err.response?.data?.detail ?? fallback;
}

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChatHistory().then(setMessages);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setError(null);
    setInput("");

    // Optimistic: show the user's message immediately rather than waiting
    // for the round trip, since the assistant reply can take a few seconds.
    const optimisticUser: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      content,
      tool_name: null,
      tool_payload: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);
    try {
      const assistantMessage = await sendChatMessage(content);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(describeError(err, "The coach didn't respond. Please try again."));
    } finally {
      setSending(false);
    }
  }

  async function handleWeeklyCheckin() {
    setError(null);
    setSending(true);
    try {
      const message = await requestWeeklyCheckin();
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(describeError(err, "Couldn't generate a check-in right now."));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100svh-57px)] max-w-3xl flex-col px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Coach</h1>
          <p className="text-sm text-ink-muted">
            Grounded in your logged weight, workouts, and PRs — not generic advice.
          </p>
        </div>
        <button
          onClick={handleWeeklyCheckin}
          disabled={sending}
          className="rounded-md border border-line-strong px-3 py-1.5 text-sm transition hover:bg-surface-hover disabled:opacity-50"
        >
          Weekly check-in
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-line bg-surface p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-ink-muted">
            Ask about your training, a workout split, or your macros to get started.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-accent text-white"
                  : "border border-line bg-bg text-ink"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.tool_payload && <ToolResultCard payload={m.tool_payload} />}
              <p
                className={`mt-1 text-[10px] ${m.role === "user" ? "text-white/70" : "text-ink-muted"}`}
              >
                {formatTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-line bg-bg px-4 py-2 text-sm text-ink-muted">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach anything..."
          disabled={sending}
          className="flex-1 rounded-md border border-line-strong bg-surface px-4 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
