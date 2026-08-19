import { api } from "../lib/api";
import type { AppNotification } from "../types/notification";

/** Returns at most one notification — the backend's eligibility system
 * already picks the single highest-priority one, so there's nothing to
 * rank or filter here. */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await api.get<AppNotification[]>("/notifications");
  return res.data;
}
