import { api } from "../lib/api";
import type { ChatMessage } from "../types/chat";

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const res = await api.get<ChatMessage[]>("/chat/messages");
  return res.data;
}

export async function sendChatMessage(content: string): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>("/chat/messages", { content });
  return res.data;
}

export async function requestWeeklyCheckin(): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>("/chat/weekly-checkin");
  return res.data;
}
