import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchWorkouts } from "../api/workouts";
import type { WorkoutSummary } from "../types/workout";

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // Monday as week start
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function WorkoutsSummaryCard() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[] | null>(null);

  useEffect(() => {
    fetchWorkouts().then(setWorkouts);
  }, []);

  if (workouts === null) return null;

  const weekStart = startOfWeek();
  const thisWeek = workouts.filter((w) => new Date(w.performed_at) >= weekStart);

  return (
    <Link
      to="/workouts"
      className="block rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong"
    >
      <p className="text-xs text-ink-muted">This week's workouts</p>
      <p className="mt-1 text-2xl font-semibold">{thisWeek.length}</p>
      <p className="mt-1 text-xs text-accent">
        {workouts.length === 0 ? "Log your first workout" : "View all workouts"} &rarr;
      </p>
    </Link>
  );
}
