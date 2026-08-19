import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dumbbell, Play } from "lucide-react";
import { listWorkouts } from "../api/workouts";
import { useActiveWorkoutStore } from "../store/activeWorkoutStore";
import { useAuthStore } from "../store/authStore";
import NotificationBanner from "../components/NotificationBanner";
import StreaksCards from "../components/StreaksCards";
import WeightTrendCard from "../components/WeightTrendCard";
import { formatHeight, formatWeight } from "../lib/units";
import type { WorkoutSummary } from "../types/workout";

function formatWorkoutDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const workoutInProgress = useActiveWorkoutStore((s) => s.isActive());
  const activeWorkoutName = useActiveWorkoutStore((s) => s.name);
  const [lastWorkout, setLastWorkout] = useState<WorkoutSummary | null>(null);

  useEffect(() => {
    listWorkouts()
      .then((workouts) => setLastWorkout(workouts[0] ?? null))
      .catch(() => {
        // The quick-action card degrades to "Start Workout" with no last-
        // workout line — not worth a toast for a background dashboard fetch.
      });
  }, []);

  // ProtectedRoute guarantees user is set before this renders.
  if (!user) return null;

  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="mb-2 text-2xl font-semibold">Welcome, {user.full_name}</h1>

        <NotificationBanner />

        <Link
          to={workoutInProgress ? "/workouts/active" : "/workouts"}
          className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 p-5 transition hover:border-accent"
        >
          <div className="min-w-0">
            {workoutInProgress ? (
              <>
                <p className="text-xs text-accent">Workout in progress</p>
                <p className="mt-1 truncate font-medium">{activeWorkoutName}</p>
              </>
            ) : lastWorkout ? (
              <>
                <p className="text-xs text-accent">Ready to train?</p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Last: {lastWorkout.name} &middot; {formatWorkoutDate(lastWorkout.performed_at)} &middot;{" "}
                  {lastWorkout.set_count} sets
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-accent">Ready to train?</p>
                <p className="mt-1 text-sm text-ink-secondary">Log your first workout to get started.</p>
              </>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
            {workoutInProgress ? <Play size={14} /> : <Dumbbell size={14} />}
            {workoutInProgress ? "Resume" : "Start Workout"}
          </span>
        </Link>

        <Link
          to="/coach"
          className="flex items-center justify-between rounded-xl border border-line bg-surface p-5 transition hover:border-line-strong"
        >
          <div>
            <p className="text-xs text-ink-muted">Chat with your AI coach</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Grounded in your logged weight and macro targets
            </p>
          </div>
          <span className="text-accent">&rarr;</span>
        </Link>

        <WeightTrendCard />

        <StreaksCards />

        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="mb-3 text-xs text-ink-muted">Your profile</p>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd className="mt-0.5">{user.email}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Age</dt>
              <dd className="mt-0.5">{user.age}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Height</dt>
              <dd className="mt-0.5">{formatHeight(user.height_cm, user.unit_length)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Goal weight</dt>
              <dd className="mt-0.5">
                {user.goal_weight_kg ? (
                  formatWeight(user.goal_weight_kg, user.unit_weight)
                ) : (
                  <Link to="/profile" className="text-accent hover:underline">
                    Set in profile
                  </Link>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Training experience</dt>
              <dd className="mt-0.5 capitalize">{user.training_experience}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Activity level</dt>
              <dd className="mt-0.5 capitalize">{user.activity_level.replace("_", " ")}</dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}
