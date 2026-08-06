import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addSet, deleteSet, fetchWorkout } from "../api/workouts";
import { ExercisePicker } from "../components/ExercisePicker";
import type { Exercise } from "../types/exercise";
import type { WorkoutDetail } from "../types/workout";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prBanner, setPrBanner] = useState<string | null>(null);

  async function refresh() {
    if (!id) return;
    setWorkout(await fetchWorkout(id));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddSet(e: FormEvent) {
    e.preventDefault();
    if (!id || !exercise || !reps || !weight) return;
    setSaving(true);
    setPrBanner(null);
    try {
      const newSet = await addSet(id, {
        exercise_id: exercise.id,
        reps: Number(reps),
        weight_kg: Number(weight),
        rpe: rpe ? Number(rpe) : undefined,
        is_warmup: isWarmup,
      });
      if (newSet.is_pr) {
        setPrBanner(`New PR: ${newSet.exercise_name} at ${newSet.weight_kg} kg!`);
      }
      setReps("");
      setWeight("");
      setRpe("");
      setIsWarmup(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSet(setId: string) {
    if (!id) return;
    await deleteSet(id, setId);
    await refresh();
  }

  if (!workout) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/workouts" className="text-sm text-violet-400 hover:underline">
        &larr; All workouts
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-semibold">{workout.name}</h1>
      <p className="mb-6 text-sm text-neutral-500">{formatDate(workout.performed_at)}</p>

      {prBanner && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          {prBanner}
        </div>
      )}

      <form
        onSubmit={handleAddSet}
        className="mb-8 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
      >
        <ExercisePicker value={exercise} onChange={setExercise} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-neutral-500" htmlFor="reps">
              Reps
            </label>
            <input
              id="reps"
              type="number"
              min={1}
              required
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-500" htmlFor="weight">
              Weight (kg)
            </label>
            <input
              id="weight"
              type="number"
              step="0.5"
              min={0}
              required
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-24 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-500" htmlFor="rpe">
              RPE
            </label>
            <input
              id="rpe"
              type="number"
              step="0.5"
              min={1}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={isWarmup}
              onChange={(e) => setIsWarmup(e.target.checked)}
              className="rounded border-neutral-700"
            />
            Warmup
          </label>
          <button
            type="submit"
            disabled={saving || !exercise}
            className="rounded-md bg-violet-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add set"}
          </button>
        </div>
      </form>

      {workout.sets.length === 0 ? (
        <p className="text-sm text-neutral-500">No sets logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {workout.sets.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-xs text-neutral-600">#{s.set_number}</span>
                <div>
                  <p className="text-sm font-medium">
                    {s.exercise_name}
                    {s.is_warmup && (
                      <span className="ml-2 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                        warmup
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {s.reps} reps &times; {s.weight_kg} kg
                    {s.rpe != null && ` @ RPE ${s.rpe}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteSet(s.id)}
                className="text-xs text-neutral-500 hover:text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
