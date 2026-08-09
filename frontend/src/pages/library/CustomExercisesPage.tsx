import { type FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Wrench, X } from "lucide-react";
import {
  createCustomExercise,
  deleteCustomExercise,
  fetchCustomExercises,
  updateCustomExercise,
} from "../../api/customExercises";
import { EmptyState } from "../../components/EmptyState";
import { inputClass } from "../../components/FormField";
import { Skeleton } from "../../components/Skeleton";
import { toast } from "../../store/toastStore";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { CustomExercise, CustomExercisePayload } from "../../types/library";
import type { ExerciseCategory, MovementType } from "../../types/exercise";
import type { ExperienceLevel } from "../../types/user";

const CATEGORY_OPTIONS: ExerciseCategory[] = ["push", "pull", "legs", "upper", "lower", "full_body", "core"];
const MOVEMENT_OPTIONS: MovementType[] = ["compound", "isolation"];
const DIFFICULTY_OPTIONS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

const humanize = (s: string) => s.replace(/_/g, " ");

const emptyForm: CustomExercisePayload = {
  name: "",
  description: "",
  primary_muscles: [],
  secondary_muscles: [],
  equipment: "",
  movement_type: "compound",
  category: "push",
  difficulty: "beginner",
};

export default function CustomExercisesPage() {
  const [exercises, setExercises] = useState<CustomExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomExercisePayload>(emptyForm);
  const [primaryMusclesInput, setPrimaryMusclesInput] = useState("");
  const [secondaryMusclesInput, setSecondaryMusclesInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const results = await fetchCustomExercises({ q: debouncedQ || undefined });
    setExercises(results);
  }

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setPrimaryMusclesInput("");
    setSecondaryMusclesInput("");
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(exercise: CustomExercise) {
    setEditingId(exercise.id);
    setForm({
      name: exercise.name,
      description: exercise.description ?? "",
      primary_muscles: exercise.primary_muscles,
      secondary_muscles: exercise.secondary_muscles,
      equipment: exercise.equipment,
      movement_type: exercise.movement_type,
      category: exercise.category,
      difficulty: exercise.difficulty,
    });
    setPrimaryMusclesInput(exercise.primary_muscles.join(", "));
    setSecondaryMusclesInput(exercise.secondary_muscles.join(", "));
    setError(null);
    setFormOpen(true);
  }

  function parseMuscles(input: string): string[] {
    return input
      .split(",")
      .map((m) => m.trim().toLowerCase().replace(/\s+/g, "_"))
      .filter(Boolean);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: CustomExercisePayload = {
      ...form,
      primary_muscles: parseMuscles(primaryMusclesInput),
      secondary_muscles: parseMuscles(secondaryMusclesInput),
    };
    if (payload.primary_muscles.length === 0) {
      setError("Add at least one primary muscle.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCustomExercise(editingId, payload);
        toast.success("Custom exercise updated");
      } else {
        await createCustomExercise(payload);
        toast.success("Custom exercise created");
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(typeof detail === "string" ? detail : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exercise: CustomExercise) {
    await deleteCustomExercise(exercise.id);
    setExercises((prev) => prev.filter((e) => e.id !== exercise.id));
    toast.success("Custom exercise deleted");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Machine names, home equipment, gym-specific variations, anything not in the shared library.
          The AI Coach uses these too when it builds you a split.
        </p>
        <button
          onClick={openCreateForm}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
        >
          <Plus size={16} /> New custom exercise
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-4 rounded-xl border border-accent/40 bg-accent/[0.03] p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{editingId ? "Edit custom exercise" : "New custom exercise"}</h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-full p-1 text-ink-muted transition hover:bg-surface-hover"
            >
              <X size={16} />
            </button>
          </div>

          {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-ink-muted">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Hammer Strength Incline Press"
                className={inputClass}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-ink-muted">Description (optional)</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Primary muscles (comma-separated)</label>
              <input
                required
                value={primaryMusclesInput}
                onChange={(e) => setPrimaryMusclesInput(e.target.value)}
                placeholder="chest, front_delts"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Secondary muscles (optional)</label>
              <input
                value={secondaryMusclesInput}
                onChange={(e) => setSecondaryMusclesInput(e.target.value)}
                placeholder="triceps"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Equipment</label>
              <input
                required
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="machine"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Movement type</label>
              <select
                value={form.movement_type}
                onChange={(e) => setForm({ ...form, movement_type: e.target.value as MovementType })}
                className={inputClass}
              >
                {MOVEMENT_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {humanize(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ExerciseCategory })}
                className={inputClass}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value as ExperienceLevel })}
                className={inputClass}
              >
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {humanize(d)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Create exercise"}
          </button>
        </form>
      )}

      <input
        type="search"
        placeholder="Search your custom exercises..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-6 w-full max-w-sm rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && exercises.length === 0 && (
        <EmptyState
          icon={Wrench}
          message="No custom exercises yet. Add your gym's machine names or any movement missing from the library."
          actionLabel="Add your first custom exercise"
          onAction={openCreateForm}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!loading &&
          exercises.map((exercise) => (
            <div key={exercise.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{exercise.name}</h3>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEditForm(exercise)}
                    aria-label="Edit"
                    className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-ink active:scale-90"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(exercise)}
                    aria-label="Delete"
                    className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-red-400 active:scale-90"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs capitalize text-ink-muted">
                {humanize(exercise.category)} &middot; {humanize(exercise.equipment)} &middot;{" "}
                {exercise.movement_type}
              </p>
              <p className="mt-2 text-xs text-ink-secondary">
                {exercise.primary_muscles.map(humanize).join(", ")}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
