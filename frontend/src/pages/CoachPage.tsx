import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  createChatSession,
  fetchChatSessions,
  fetchSessionMessages,
  requestWeeklyCheckin,
  sendChatMessage,
} from "../api/chat";
import { ChatBubbleIcon } from "../components/icons";
import DumbbellSpinner from "../components/DumbbellSpinner";
import MarkdownMessage from "../components/MarkdownMessage";
import { Skeleton } from "../components/Skeleton";
import ToolResultCard from "../components/ToolResultCard";
import { describeChatError } from "../lib/chatErrors";
import type { ChatMessage, ChatSession } from "../types/chat";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CoachPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // A fresh visit to the Coach page always starts a new, empty
    // conversation. Past sessions are one click away in the sidebar, not
    // auto-resumed, per the product decision to match ChatGPT/Claude.
    fetchChatSessions()
      .then(setSessions)
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openSession(sessionId: string) {
    setError(null);
    setActiveSessionId(sessionId);
    setSidebarOpen(false);
    setLoadingSession(true);
    try {
      const history = await fetchSessionMessages(sessionId);
      setMessages(history);
    } finally {
      setLoadingSession(false);
    }
  }

  function startNewChat() {
    setError(null);
    setActiveSessionId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  /** Sessions aren't created until the first message actually needs one, so
   * clicking "New chat" repeatedly doesn't litter the sidebar with empty
   * threads. */
  async function ensureSession(): Promise<string> {
    if (activeSessionId) return activeSessionId;
    const session = await createChatSession();
    setActiveSessionId(session.id);
    setSessions((prev) => [session, ...prev]);
    return session.id;
  }

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
      session_id: activeSessionId ?? "pending",
      role: "user",
      content,
      tool_name: null,
      tool_payload: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);
    try {
      const sessionId = await ensureSession();
      const assistantMessage = await sendChatMessage(sessionId, content);
      setMessages((prev) => [...prev, assistantMessage]);
      // Refreshes the title (auto-generated from the first message) and
      // the most-recently-active sort order in one cheap round trip.
      fetchChatSessions().then(setSessions);
    } catch (err) {
      setError(describeChatError(err, "The coach didn't respond. Please try again."));
    } finally {
      setSending(false);
    }
  }

  async function handleWeeklyCheckin() {
    setError(null);
    setSending(true);
    try {
      const sessionId = await ensureSession();
      const message = await requestWeeklyCheckin(sessionId);
      setMessages((prev) => [...prev, message]);
      fetchChatSessions().then(setSessions);
    } catch (err) {
      setError(describeChatError(err, "Couldn't generate a check-in right now."));
    } finally {
      setSending(false);
    }
  }

  const sidebarContent = (
    <>
      <div className="p-3">
        <button
          onClick={startNewChat}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-sm font-medium transition hover:bg-surface-hover active:scale-[0.98]"
        >
          + New chat
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {sessionsLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-2 py-2">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="mt-1.5 h-2.5 w-1/3" />
            </div>
          ))}
        {!sessionsLoading && sessions.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <ChatBubbleIcon className="h-5 w-5 text-ink-muted" />
            <p className="text-xs text-ink-muted">No past conversations yet.</p>
          </div>
        )}
        {!sessionsLoading &&
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s.id)}
              className={`block w-full truncate rounded-md px-2 py-2 text-left text-sm transition active:scale-[0.98] ${
                s.id === activeSessionId
                  ? "bg-surface-hover text-ink"
                  : "text-ink-secondary hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <span className="block truncate">{s.title ?? "New chat"}</span>
              <span className="block text-[10px] text-ink-muted">{formatSessionDate(s.updated_at)}</span>
            </button>
          ))}
      </div>
    </>
  );

  return (
    <main className="mx-auto flex h-[calc(100svh-57px)] max-w-6xl gap-4 px-4 py-4 sm:px-6 sm:py-6">
      {/* Desktop: permanent left column. Mobile: slide-in drawer + backdrop,
          toggled by the "History" button next to the page title below. */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-line bg-surface md:flex">
        {sidebarContent}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface transition-transform duration-200 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line-strong transition hover:bg-surface-hover active:scale-[0.97] md:hidden"
              aria-label="Chat history"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">AI Coach</h1>
              <p className="hidden text-sm text-ink-muted sm:block">
                Grounded in your logged weight and macro targets, not generic advice.
              </p>
            </div>
          </div>
          <button
            onClick={handleWeeklyCheckin}
            disabled={sending}
            className="shrink-0 rounded-md border border-line-strong px-3 py-1.5 text-sm transition hover:bg-surface-hover active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            Weekly check-in
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-line bg-surface p-4">
          {loadingSession && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Skeleton className="h-10 w-2/5 rounded-xl" />
              </div>
              <div className="flex justify-start">
                <Skeleton className="h-16 w-3/5 rounded-xl" />
              </div>
            </div>
          )}
          {!loadingSession && messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <ChatBubbleIcon className="h-8 w-8 text-ink-muted" />
              <p className="text-sm text-ink-secondary">
                Ask about your training, a workout split, or your macros to get started.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                Start typing
              </button>
            </div>
          )}
          {!loadingSession &&
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-accent text-white"
                      : "border border-line bg-bg text-ink"
                  }`}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <>
                      {m.tool_payload && (
                        <>
                          <ToolResultCard payload={m.tool_payload} />
                          <div className="my-3 border-t border-line" />
                        </>
                      )}
                      <MarkdownMessage content={m.content} />
                    </>
                  )}
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
              <div className="rounded-xl border border-line bg-bg px-4 py-3">
                <DumbbellSpinner label="Thinking..." />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <form onSubmit={handleSend} className="mt-4 flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach anything..."
            disabled={sending}
            className="flex-1 rounded-md border border-line-strong bg-surface px-4 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            Send
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-ink-muted">
          LiftRyt AI can make mistakes. Check important info before relying on it.
        </p>
      </div>
    </main>
  );
}
