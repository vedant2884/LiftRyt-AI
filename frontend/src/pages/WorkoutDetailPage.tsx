import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteWorkout, getWorkout } from "../api/workouts";
import { Skeleton } from "../components/Skeleton";
import { toast } from "../store/toastStore";
import type { WorkoutDetail } from "../types/workout";

function groupByExercise(detail: WorkoutDetail) {
  const groups: { key: string; name: string; sets: WorkoutDetail["sets"] }[] = [];
  const byKey = new Map<string, (typeof groups)[number]>();
  for (const s of detail.sets) {
    const key = s.is_custom ? `custom:${s.custom_exercise_id}` : `real:${s.exercise_id}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, name: s.exercise_name, sets: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.sets.push(s);
  }
  return groups;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    getWorkout(id)
      .then(setWorkout)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    try {
      await deleteWorkout(id);
      toast.success("Workout deleted");
      navigate("/workouts");
    } catch {
      toast.error("Couldn't delete this workout. Please try again.");
    }
  }

  const totalVolume = workout
    ? workout.sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0)
    : 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/workouts" className="mb-4 flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeft size={14} /> Workouts
      </Link>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {!loading && loadError && (
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-secondary">
          Couldn't load this workout. It may have been deleted, or you may not have access to it.
        </p>
      )}

      {!loading && workout && (
        <>
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{workout.name}</h1>
              <p className="mt-1 text-sm text-ink-muted">
                {new Date(workout.performed_at).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            {confirmingDelete ? (
              <div className="flex shrink-0 items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2">
                <span className="text-xs text-ink-secondary">Delete?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-md border border-line-strong px-2.5 py-1 text-xs hover:bg-surface-hover"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete workout"
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-ink-muted transition hover:bg-surface-hover hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <p className="text-lg font-semibold">{workout.sets.length}</p>
              <p className="text-xs text-ink-muted">Sets</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <p className="text-lg font-semibold">{Math.round(totalVolume)} kg</p>
              <p className="text-xs text-ink-muted">Volume</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3 text-center">
              <p className="text-lg font-semibold">{formatDuration(workout.duration_seconds) ?? "—"}</p>
              <p className="text-xs text-ink-muted">Duration</p>
            </div>
          </div>

          <div className="space-y-4">
            {groupByExercise(workout).map((group) => (
              <div key={group.key} className="rounded-xl border border-line bg-surface p-4">
                <h2 className="mb-2 font-medium">{group.name}</h2>
                <div className="space-y-1">
                  {group.sets.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-center text-xs text-ink-muted">{s.set_number}</span>
                      <span className="text-ink">{s.weight_kg} kg</span>
                      <span className="text-ink-secondary">&times; {s.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
