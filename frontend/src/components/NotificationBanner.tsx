import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { fetchNotifications } from "../api/notifications";
import type { AppNotification } from "../types/notification";

/** The backend already picks at most one notification per the app's
 * "never spammy" rule, so this just displays it (or nothing) — no local
 * ranking/filtering. Dismissal is per-session only: there's no delivery
 * infra to mark it "seen" server-side, so it reappears on next load, same
 * as the rest of this stateless notification system. */
export default function NotificationBanner() {
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchNotifications()
      .then((list) => setNotification(list[0] ?? null))
      .catch(() => {
        // Non-critical background fetch — dashboard works fine without it.
      });
  }, []);

  if (!notification || dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
      <Bell size={18} className="mt-0.5 shrink-0 text-accent" />
      <p className="flex-1 text-sm text-ink">{notification.message}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-ink-muted transition hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}
