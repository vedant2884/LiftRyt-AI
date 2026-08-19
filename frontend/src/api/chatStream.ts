import { useAuthStore } from "../store/authStore";
import type { ChatMessage, ExerciseChatContext } from "../types/chat";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type ChatStreamEvent =
  | { type: "start"; user_message: ChatMessage }
  | { type: "delta"; content: string }
  | { type: "tool_result"; tool_name: string; arguments: Record<string, unknown>; result: unknown }
  | { type: "done"; assistant_message: ChatMessage }
  | { type: "error"; detail: string };

/** Splits the raw SSE byte stream on blank-line-terminated events and JSON-
 * parses each `data: ` line — deliberately not the browser's EventSource,
 * which only supports GET requests and can't carry this endpoint's POST
 * body (the message content) or an Authorization header. */
async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const raw of events) {
        const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        yield JSON.parse(dataLine.slice("data: ".length)) as ChatStreamEvent;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function streamRequest(
  path: string,
  method: "POST" | "PATCH",
  body: { content: string; exercise_context?: ExerciseChatContext },
  signal?: AbortSignal,
): Promise<AsyncGenerator<ChatStreamEvent>> {
  // Bypasses the shared axios instance (see lib/api.ts) — fetch is what
  // gives us a real ReadableStream to read incrementally. That does mean
  // this path skips axios's 401-refresh-and-retry interceptor; a normal
  // chat turn during an already-logged-in session doesn't hit that, so
  // it's an acceptable gap here rather than reimplementing the refresh
  // dance for one endpoint.
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });
  if (!response.body) {
    throw new Error(`Stream request to ${path} returned no body (status ${response.status})`);
  }
  return parseSseStream(response.body);
}

export function streamChatMessage(
  sessionId: string,
  content: string,
  exerciseContext?: ExerciseChatContext,
  signal?: AbortSignal,
): Promise<AsyncGenerator<ChatStreamEvent>> {
  return streamRequest(
    `/chat/sessions/${sessionId}/messages/stream`,
    "POST",
    { content, exercise_context: exerciseContext },
    signal,
  );
}

export function streamEditChatMessage(
  sessionId: string,
  messageId: string,
  content: string,
  exerciseContext?: ExerciseChatContext,
  signal?: AbortSignal,
): Promise<AsyncGenerator<ChatStreamEvent>> {
  return streamRequest(
    `/chat/sessions/${sessionId}/messages/${messageId}/stream`,
    "PATCH",
    { content, exercise_context: exerciseContext },
    signal,
  );
}
