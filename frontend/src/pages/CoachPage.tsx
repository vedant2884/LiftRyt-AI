import { type FormEvent, useEffect, useRef, useState } from "react";
import { type ChatStreamEvent, streamChatMessage, streamEditChatMessage } from "../api/chatStream";
import { createChatSession, fetchChatSessions, fetchSessionMessages } from "../api/chat";
import { Badge } from "../components/Badge";
import CoachEmptyState from "../components/coach/CoachEmptyState";
import CoachInput from "../components/coach/CoachInput";
import CoachMessageBubble from "../components/coach/CoachMessageBubble";
import CoachSidebar from "../components/coach/CoachSidebar";
import CoachThinkingIndicator from "../components/coach/CoachThinkingIndicator";
import { Skeleton } from "../components/Skeleton";
import type { ChatMessage, ChatSession, ToolPayload } from "../types/chat";

const STREAM_ERROR_MESSAGE =
  "The AI coach is temporarily unavailable. Check that an LLM provider is configured (see backend/.env).";

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export default function CoachPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Set once the streaming reply's placeholder bubble exists (first delta
  // or tool_result event) — drives hiding the dumbbell "Thinking" bubble
  // in favor of the real, growing reply, instead of waiting for the whole
  // response like before.
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    setEditingMessageId(null);
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
    setEditingMessageId(null);
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

  /** Drives one streamed reply into `messages`, from whichever SSE
   * generator the caller hands it (a new send or a post-edit
   * regeneration) — both need identical delta/tool_result/done/error
   * handling, just a different call to start the stream. */
  async function consumeStream(
    sessionId: string,
    events: AsyncGenerator<ChatStreamEvent>,
    onUserMessage: (message: ChatMessage) => void,
  ) {
    const streamingId = `streaming-${Date.now()}`;

    /** Creates the streaming placeholder bubble on first use (also
     * flipping streamingMessageId, which hides the dumbbell), or patches
     * the existing one — patch is computed from the current message so a
     * delta can append rather than overwrite its content. */
    function applyToPlaceholder(patch: (existing: ChatMessage | null) => Partial<ChatMessage>) {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === streamingId);
        if (idx === -1) {
          setStreamingMessageId(streamingId);
          const placeholder: ChatMessage = {
            id: streamingId,
            session_id: sessionId,
            role: "assistant",
            content: "",
            tool_name: null,
            tool_payload: null,
            created_at: new Date().toISOString(),
            ...patch(null),
          };
          return [...prev, placeholder];
        }
        return prev.map((m, i) => (i === idx ? { ...m, ...patch(m) } : m));
      });
    }

    for await (const event of events) {
      if (event.type === "start") {
        onUserMessage(event.user_message);
      } else if (event.type === "delta") {
        applyToPlaceholder((existing) => ({ content: (existing?.content ?? "") + event.content }));
      } else if (event.type === "tool_result") {
        const toolPayload: ToolPayload = {
          name: event.tool_name,
          arguments: event.arguments,
          result: event.result as ToolPayload["result"],
        };
        applyToPlaceholder(() => ({ tool_name: event.tool_name, tool_payload: toolPayload }));
      } else if (event.type === "done") {
        setMessages((prev) => prev.map((m) => (m.id === streamingId ? event.assistant_message : m)));
        setStreamingMessageId(null);
        fetchChatSessions().then(setSessions);
      } else if (event.type === "error") {
        // No visible content ever arrived for this turn — drop the empty
        // placeholder rather than leaving a blank bubble in the thread.
        setMessages((prev) => prev.filter((m) => m.id !== streamingId || m.content));
        setStreamingMessageId(null);
        setError(STREAM_ERROR_MESSAGE);
      }
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setError(null);
    setInput("");

    // Optimistic: show the user's message immediately rather than waiting
    // for the round trip — the dumbbell "Thinking" bubble covers the gap
    // until the first real token streams in.
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
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const sessionId = await ensureSession();
      const events = await streamChatMessage(sessionId, content, undefined, controller.signal);
      await consumeStream(sessionId, events, (userMessage) => {
        // Swaps the client-only optimistic id for the real persisted one —
        // otherwise this message could never later be the target of an edit.
        setMessages((prev) => prev.map((m) => (m.id === optimisticUser.id ? userMessage : m)));
      });
    } catch (err) {
      // An intentional Stop click, not a failure — whatever text had
      // already streamed in stays in the thread, we just stop waiting for
      // more of it.
      if (isAbortError(err)) return;
      setError(STREAM_ERROR_MESSAGE);
    } finally {
      setSending(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  function handleStartEdit(messageId: string) {
    if (sending) return;
    setError(null);
    setEditingMessageId(messageId);
  }

  async function handleSaveEdit(messageId: string, newContent: string) {
    const content = newContent.trim();
    if (!content || !activeSessionId) return;
    setError(null);
    setEditingMessageId(null);

    // Optimistic: keep everything up to the edited message (with its new
    // text), drop everything after — the stale reply and any later turns
    // no longer apply to the edited premise.
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), { ...prev[idx], content }];
    });
    setSending(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const events = await streamEditChatMessage(activeSessionId, messageId, content, undefined, controller.signal);
      await consumeStream(activeSessionId, events, () => {});
    } catch (err) {
      if (isAbortError(err)) return;
      // The edit + truncation already happened server-side even if
      // regeneration itself failed (see backend/app/services/agent.py) —
      // re-sync from the server instead of guessing at the real state.
      try {
        const history = await fetchSessionMessages(activeSessionId);
        setMessages(history);
      } catch {
        // Keep the optimistic truncated view if even the resync fails.
      }
      setError(STREAM_ERROR_MESSAGE);
    } finally {
      setSending(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
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
          {!loadingSession &&
            messages.map((m) => (
              <CoachMessageBubble
                key={m.id}
                message={m}
                editable={!sending && !m.id.startsWith("pending-")}
                editing={editingMessageId === m.id}
                onStartEdit={() => handleStartEdit(m.id)}
                onCancelEdit={() => setEditingMessageId(null)}
                onSaveEdit={(content) => handleSaveEdit(m.id, content)}
              />
            ))}
          {/* Dumbbell shows from send until the first token/tool result
              actually arrives, not for the whole reply — see
              streamingMessageId above. */}
          {sending && !streamingMessageId && <CoachThinkingIndicator />}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <div className="mt-4">
          <CoachInput
            ref={inputRef}
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            disabled={sending}
            onStop={sending ? handleStop : undefined}
          />
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-muted">
          LiftRyt AI can make mistakes. Check important info before relying on it.
        </p>
      </div>
    </main>
  );
}
