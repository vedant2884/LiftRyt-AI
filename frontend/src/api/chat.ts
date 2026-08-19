import { api } from "../lib/api";
import type { ChatMessage, ChatSession, ExerciseChatContext, SendMessageResult } from "../types/chat";

export async function fetchChatSessions(): Promise<ChatSession[]> {
  const res = await api.get<ChatSession[]>("/chat/sessions");
  return res.data;
}

export async function createChatSession(): Promise<ChatSession> {
  const res = await api.post<ChatSession>("/chat/sessions");
  return res.data;
}

export async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await api.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
  return res.data;
}

export async function sendChatMessage(
  sessionId: string,
  content: string,
  exerciseContext?: ExerciseChatContext,
  signal?: AbortSignal,
): Promise<SendMessageResult> {
  const res = await api.post<SendMessageResult>(
    `/chat/sessions/${sessionId}/messages`,
    { content, exercise_context: exerciseContext },
    { signal },
  );
  return res.data;
}

/** Edits a past user message and regenerates from that point — the backend
 * discards the stale reply (and anything after it) and returns the fresh
 * assistant reply; callers should re-sync their local message list around
 * it rather than just swapping the edited message's text in place. */
export async function editChatMessage(
  sessionId: string,
  messageId: string,
  content: string,
  exerciseContext?: ExerciseChatContext,
  signal?: AbortSignal,
): Promise<ChatMessage> {
  const res = await api.patch<ChatMessage>(
    `/chat/sessions/${sessionId}/messages/${messageId}`,
    { content, exercise_context: exerciseContext },
    { signal },
  );
  return res.data;
}
