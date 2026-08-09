import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStreaks } from "../api/streaks";
import { CalendarCheckIcon, FlameIcon } from "./icons";
import { Skeleton } from "./Skeleton";
import type { Streaks } from "../types/streaks";

function CardShell({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line bg-surface p-5">{children}</div>;
}

export default function StreaksCards() {
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreaks()
      .then(setStreaks)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <CardShell key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-16" />
          </CardShell>
        ))}
      </div>
    );
  }

  if (!streaks) return null;

  const { logging_streak_days, weekly_adherence } = streaks;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CardShell>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <FlameIcon className="h-4 w-4" />
          Logging streak
        </div>
        <p className="mt-1 text-2xl font-semibold">
          {logging_streak_days} {logging_streak_days === 1 ? "day" : "days"}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {logging_streak_days > 0
            ? "Consecutive days with a weight entry."
            : "Log your weight today to start a streak."}
        </p>
      </CardShell>

      <CardShell>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <CalendarCheckIcon className="h-4 w-4" />
          This week's adherence
        </div>
        {weekly_adherence ? (
          <>
            <p className="mt-1 text-2xl font-semibold">
              {weekly_adherence.completed}/{weekly_adherence.planned}
            </p>
            <p className="mt-1 text-xs text-ink-muted">Planned workouts completed this week.</p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-secondary">No active split yet.</p>
            <Link to="/splits" className="mt-2 inline-block text-xs text-accent hover:underline">
              Generate a split &rarr;
            </Link>
          </>
        )}
      </CardShell>
    </div>
  );
}
