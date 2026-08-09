import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { createWorkout, deleteWorkout, updateWorkout } from "../api/workouts";
import { fetchProgressions } from "../api/progressions";
import ActiveExerciseCard from "../components/workout/ActiveExerciseCard";
import ExercisePickerSheet, { type PickedExercise } from "../components/workout/ExercisePickerSheet";
import RestTimer from "../components/workout/RestTimer";
import WorkoutSummaryBar from "../components/workout/WorkoutSummaryBar";
import { applySuggestionToExercise } from "../lib/progressionSuggestions";
import { useActiveWorkoutStore } from "../store/activeWorkoutStore";
import { toast } from "../store/toastStore";
import type { ExerciseProgression } from "../types/progression";

export default function ActiveWorkoutPage() {
  const navigate = useNavigate();
  const isActive = useActiveWorkoutStore((s) => s.isActive());
  const name = useActiveWorkoutStore((s) => s.name);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const workoutId = useActiveWorkoutStore((s) => s.workoutId);
  const setWorkoutId = useActiveWorkoutStore((s) => s.setWorkoutId);
  const clearExercises = useActiveWorkoutStore((s) => s.clearExercises);
  const discard = useActiveWorkoutStore((s) => s.discard);
  const resetStaleSaving = useActiveWorkoutStore((s) => s.resetStaleSaving);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [progressions, setProgressions] = useState<ExerciseProgression[]>([]);
  const wasPrefilled = useRef(exercises.length > 0);
  const creatingWorkoutRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    resetStaleSaving();
    fetchProgressions()
      .then(setProgressions)
      .catch(() => {
        // A missed suggested-weight prefill is a nicety lost, not a broken
        // workflow — logging still works fine blank.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isActive) navigate("/workouts", { replace: true });
  }, [isActive, navigate]);

  if (!isActive || !startedAt) return null;

  // Concurrent "Complete Set" taps across different exercise cards must
  // share one workout-creation call — without this, two near-simultaneous
  // first sets would each try to lazily create the Workout row.
  async function ensureWorkoutId(): Promise<string> {
    const current = useActiveWorkoutStore.getState().workoutId;
    if (current) return current;
    creatingWorkoutRef.current ??= createWorkout({ name, performed_at: startedAt! })
      .then((w) => {
        setWorkoutId(w.id);
        return w.id;
      })
      .finally(() => {
        creatingWorkoutRef.current = null;
      });
    return creatingWorkoutRef.current;
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      const id = workoutId;
      if (id) {
        const durationSeconds = Math.max(
          0,
          Math.round((Date.now() - new Date(startedAt!).getTime()) / 1000),
        );
        await updateWorkout(id, { duration_seconds: durationSeconds });
        discard();
        navigate(`/workouts/${id}`);
        toast.success("Workout saved");
      } else {
        // Nothing was ever completed — nothing to save, same outcome as a discard.
        discard();
        navigate("/workouts");
      }
    } catch {
      toast.error("Couldn't finish the workout. Please try again.");
    } finally {
      setFinishing(false);
    }
  }

  async function handleDiscard() {
    try {
      if (workoutId) await deleteWorkout(workoutId);
      discard();
      navigate("/workouts");
    } catch {
      toast.error("Couldn't discard the workout. Please try again.");
    }
  }

  function handlePickExercise(picked: PickedExercise) {
    const exerciseLocalId = useActiveWorkoutStore.getState().addExercise(picked);
    applySuggestionToExercise(exerciseLocalId, picked.isCustom ? undefined : picked.id, progressions);
    setProgressions((prev) => prev.filter((p) => p.exercise_id !== picked.id));
    setPickerOpen(false);
  }

  const totalSets = exercises.reduce((sum, e) => sum + e.sets.filter((s) => s.completed).length, 0);
  const totalVolumeKg = exercises.reduce(
    (sum, e) =>
      sum +
      e.sets
        .filter((s) => s.completed)
        .reduce((exSum, s) => exSum + Number(s.weight) * Number(s.reps), 0),
    0,
  );

  return (
    <div className="flex min-h-[calc(100svh-57px)] flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{name}</h1>
            <p className="text-xs text-ink-muted">
              {new Date(startedAt).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          {confirmingDiscard ? (
            <div className="flex shrink-0 items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2">
              <span className="text-xs text-ink-secondary">Discard workout?</span>
              <button
                type="button"
                onClick={handleDiscard}
                className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDiscard(false)}
                className="rounded-md border border-line-strong px-2.5 py-1 text-xs hover:bg-surface-hover"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDiscard(true)}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-muted transition hover:bg-surface-hover hover:text-red-400"
            >
              <X size={13} /> Discard
            </button>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
          <RestTimer />
        </div>

        {wasPrefilled.current && exercises.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-surface/60 px-3 py-2 text-xs text-ink-secondary">
            <span>Prefilled from your last {name}.</span>
            <button
              type="button"
              onClick={() => {
                clearExercises();
                wasPrefilled.current = false;
              }}
              className="font-medium text-accent hover:underline"
            >
              Clear & start blank
            </button>
          </div>
        )}

        <div className="space-y-3">
          {exercises.map((exercise, i) => (
            <ActiveExerciseCard
              key={exercise.localId}
              exercise={exercise}
              canMoveUp={i > 0}
              canMoveDown={i < exercises.length - 1}
              ensureWorkoutId={ensureWorkoutId}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-3 text-sm font-medium text-ink-secondary transition hover:border-accent/50 hover:text-ink"
        >
          <Plus size={16} /> Add exercise
        </button>
      </main>

      <WorkoutSummaryBar
        startedAt={startedAt}
        totalSets={totalSets}
        totalVolumeKg={totalVolumeKg}
        onFinish={handleFinish}
        finishing={finishing}
        canFinish
      />

      {pickerOpen && (
        <ExercisePickerSheet onSelect={handlePickExercise} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
