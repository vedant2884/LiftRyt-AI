import { isAxiosError } from "axios";

/** Shared between CoachPage's full chat and the exercise detail modal's
 * inline "Ask Coach" box, so a provider outage reads the same plain-language
 * explanation everywhere instead of a raw request error. */
export function describeChatError(err: unknown, fallback: string): string {
  if (!isAxiosError<{ detail?: string }>(err)) return fallback;
  if (err.response?.status === 502) {
    return "The AI coach is temporarily unavailable. Check that an LLM provider is configured (see backend/.env).";
  }
  return err.response?.data?.detail ?? fallback;
}
