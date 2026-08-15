import { api } from "../lib/api";
import type { ChatMessage, ChatSession, ExerciseChatContext } from "../types/chat";

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
): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>(`/chat/sessions/${sessionId}/messages`, {
    content,
    exercise_context: exerciseContext,
  });
  return res.data;
}
