import { type FormEvent, useEffect, useRef, useState } from "react";
import { createChatSession, fetchChatSessions, fetchSessionMessages, sendChatMessage } from "../api/chat";
import { Badge } from "../components/Badge";
import CoachEmptyState from "../components/coach/CoachEmptyState";
import CoachInput from "../components/coach/CoachInput";
import CoachMessageBubble from "../components/coach/CoachMessageBubble";
import CoachSidebar from "../components/coach/CoachSidebar";
import CoachThinkingIndicator from "../components/coach/CoachThinkingIndicator";
import { Skeleton } from "../components/Skeleton";
import { describeChatError } from "../lib/chatErrors";
import type { ChatMessage, ChatSession } from "../types/chat";

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

  return (
    <main className="mx-auto flex h-[calc(100svh-57px)] max-w-6xl gap-4 px-4 py-4 sm:px-6 sm:py-6">
      {/* Desktop: permanent left column. Mobile: slide-in drawer + backdrop,
          toggled by the "History" button next to the page title below. */}
      <CoachSidebar
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        activeSessionId={activeSessionId}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        onNewChat={startNewChat}
        onOpenSession={openSession}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Gym AI Coach</h1>
              <Badge variant="beta">Beta</Badge>
            </div>
            <p className="hidden text-sm text-ink-muted sm:block">
              Grounded in your logged weight and macro targets, not generic advice.
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto rounded-xl border border-line bg-surface p-4">
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
            <CoachEmptyState onStartConversation={() => inputRef.current?.focus()} />
          )}
          {!loadingSession && messages.map((m) => <CoachMessageBubble key={m.id} message={m} />)}
          {sending && <CoachThinkingIndicator />}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <div className="mt-4">
          <CoachInput ref={inputRef} value={input} onChange={setInput} onSubmit={handleSend} disabled={sending} />
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-muted">
          LiftRyt AI can make mistakes. Check important info before relying on it.
        </p>
      </div>
    </main>
  );
}
