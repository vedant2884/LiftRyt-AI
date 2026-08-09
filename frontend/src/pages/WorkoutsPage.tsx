import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Dumbbell, History, Play } from "lucide-react";
import { getWorkout, listWorkouts } from "../api/workouts";
import { fetchProgressions } from "../api/progressions";
import { fetchActiveSplit } from "../api/splits";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { applySuggestionToExercise } from "../lib/progressionSuggestions";
import { useActiveWorkoutStore } from "../store/activeWorkoutStore";
import { toast } from "../store/toastStore";
import type { SplitPlan } from "../types/split";
import type { WorkoutSummary } from "../types/workout";

const NAME_SUGGESTIONS = ["Push Day", "Pull Day", "Leg Day", "Upper Body", "Full Body", "Arms"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

export default function WorkoutsPage() {
  const navigate = useNavigate();
  const isActive = useActiveWorkoutStore((s) => s.isActive());
  const activeName = useActiveWorkoutStore((s) => s.name);

  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);
  const [pickingPrevious, setPickingPrevious] = useState(false);
  const [activeSplit, setActiveSplit] = useState<SplitPlan | null>(null);

  useEffect(() => {
    listWorkouts()
      .then(setWorkouts)
      .catch(() => toast.error("Couldn't load your workout history. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // A missing/failed active split is a normal state (no split generated
    // yet) — the "Start a workout" card below works fine without it, so
    // this stays silent rather than toasting an error.
    fetchActiveSplit()
      .then(setActiveSplit)
      .catch(() => setActiveSplit(null));
  }, []);

  async function handleStart(workoutName: string, copyFromId?: string) {
    const trimmed = workoutName.trim();
    if (!trimmed) return;
    setStarting(true);
    try {
      useActiveWorkoutStore.getState().startWorkout(trimmed);
      try {
        const sourceId =
          copyFromId ??
          workouts.find((w) => w.name.trim().toLowerCase() === trimmed.toLowerCase())?.id;
        if (sourceId) {
          const detail = await getWorkout(sourceId);
          useActiveWorkoutStore.getState().prefillFromWorkout(detail);

          // A pending "increase next weight?" suggestion should surface
          // here too, not only when an exercise is hand-picked from the
          // library — this history-based prefill is the more common way
          // an exercise actually enters a new workout.
          const progressions = await fetchProgressions();
          for (const exercise of useActiveWorkoutStore.getState().exercises) {
            applySuggestionToExercise(exercise.localId, exercise.exerciseId, progressions);
          }
        }
      } catch {
        // Prefill is a nicety — starting blank is still a fully valid outcome.
      }
      navigate("/workouts/active");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-10">
      {isActive ? (
        <button
          type="button"
          onClick={() => navigate("/workouts/active")}
          className="flex w-full items-center justify-between rounded-xl border border-accent/40 bg-accent/10 p-5 text-left transition hover:border-accent"
        >
          <div>
            <p className="text-xs text-accent">Workout in progress</p>
            <p className="mt-1 font-medium">{activeName}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
            <Play size={14} /> Resume
          </span>
        </button>
      ) : (
        <div className="space-y-4">
          {activeSplit && activeSplit.days.length > 0 && (() => {
            const todayDay =
              activeSplit.days.find((d) => d.day_number === activeSplit.next_day_number) ?? activeSplit.days[0];
            const upcoming: string[] = [];
            for (let i = 1; i < activeSplit.days.length && upcoming.length < 2; i++) {
              const dayNumber = ((activeSplit.next_day_number - 1 + i) % activeSplit.days.length) + 1;
              const day = activeSplit.days.find((d) => d.day_number === dayNumber);
              if (day && day.day_number !== todayDay.day_number) upcoming.push(day.label);
            }
            return (
              <div className="rounded-xl border border-line bg-surface p-5">
                <div className="mb-3 flex items-center gap-1.5 text-xs text-ink-secondary">
                  <CalendarDays size={13} />
                  <span>
                    Your split · {activeSplit.split_type} ({activeSplit.days_per_week} days/week)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted">Today</p>
                    <p className="truncate font-medium">{todayDay.label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStart(todayDay.label)}
                    disabled={starting}
                    className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
                  >
                    Start {todayDay.label}
                  </button>
                </div>
                {upcoming.length > 0 && (
                  <p className="mt-3 text-xs text-ink-muted">Up next: {upcoming.join(", ")}</p>
                )}
              </div>
            );
          })()}

          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-3 text-sm font-medium">Start a workout</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {NAME_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setName(s)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    name === s
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line-strong text-ink-secondary hover:border-ink-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart(name)}
                placeholder="Workout name (e.g. Saturday Workout)"
                className="flex-1 rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => handleStart(name)}
                disabled={starting || !name.trim()}
                className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
              >
                Start
              </button>
            </div>
            {workouts.length > 0 && (
              <button
                type="button"
                onClick={() => setPickingPrevious((v) => !v)}
                className="mt-3 flex items-center gap-1.5 text-xs text-ink-secondary hover:text-accent"
              >
                <History size={13} /> Use a previous workout instead
              </button>
            )}
            {pickingPrevious && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-line bg-bg p-1.5">
                {workouts.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleStart(w.name, w.id)}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition hover:bg-surface-hover"
                  >
                    <span className="truncate">{w.name}</span>
                    <span className="shrink-0 text-xs text-ink-muted">{formatDate(w.performed_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <History size={17} className="text-accent" />
          History
        </h2>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && workouts.length === 0 && (
          <EmptyState
            icon={Dumbbell}
            message="No workouts logged yet. Start your first one above."
            actionLabel="Start a workout"
            onAction={() => document.querySelector<HTMLInputElement>('input[placeholder^="Workout name"]')?.focus()}
          />
        )}

        <div className="space-y-2">
          {!loading &&
            workouts.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => navigate(`/workouts/${w.id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface p-4 text-left transition hover:border-line-strong"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{w.name}</p>
                  <p className="text-xs text-ink-muted">{formatDate(w.performed_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-ink-secondary">
                  <span>{w.set_count} sets</span>
                  {formatDuration(w.duration_seconds) && <span>{formatDuration(w.duration_seconds)}</span>}
                  <span>{Math.round(w.total_volume_kg)} kg</span>
                </div>
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
