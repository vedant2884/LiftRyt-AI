import { useEffect, useState } from "react";
import { fetchEquipmentOptions, fetchExercises, fetchMuscleOptions } from "../api/exercises";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import type { Exercise } from "../types/exercise";

const PAGE_SIZE = 24;

const CATEGORY_OPTIONS = ["push", "pull", "legs", "upper", "lower", "full_body", "core"];
const MOVEMENT_TYPE_OPTIONS = ["compound", "isolation"];
const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"];

const selectClass =
  "rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-400";

const difficultyColor: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-400",
  intermediate: "bg-amber-500/15 text-amber-400",
  advanced: "bg-red-500/15 text-red-400",
};

const humanize = (s: string) => s.replace(/_/g, " ");

export default function ExercisesPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [category, setCategory] = useState("");
  const [movementType, setMovementType] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const [muscleOptions, setMuscleOptions] = useState<string[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);

  const [items, setItems] = useState<Exercise[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchMuscleOptions().then(setMuscleOptions);
    fetchEquipmentOptions().then(setEquipmentOptions);
  }, []);

  // Any filter change starts a fresh search (offset 0, replace results).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchExercises({
      q: debouncedQ || undefined,
      muscle: muscle || undefined,
      equipment: equipment || undefined,
      category: category || undefined,
      movement_type: movementType || undefined,
      difficulty: difficulty || undefined,
      limit: PAGE_SIZE,
      offset: 0,
    }).then((res) => {
      if (cancelled) return;
      setItems(res.items);
      setTotal(res.total);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, muscle, equipment, category, movementType, difficulty]);

  async function loadMore() {
    setLoading(true);
    const res = await fetchExercises({
      q: debouncedQ || undefined,
      muscle: muscle || undefined,
      equipment: equipment || undefined,
      category: category || undefined,
      movement_type: movementType || undefined,
      difficulty: difficulty || undefined,
      limit: PAGE_SIZE,
      offset: items.length,
    });
    setItems((prev) => [...prev, ...res.items]);
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Exercise Library</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search exercises..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-400"
        />
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)} className={selectClass}>
          <option value="">All muscles</option>
          {muscleOptions.map((m) => (
            <option key={m} value={m}>
              {m.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          className={selectClass}
        >
          <option value="">All equipment</option>
          {equipmentOptions.map((eq) => (
            <option key={eq} value={eq}>
              {eq.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectClass}
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={movementType}
          onChange={(e) => setMovementType(e.target.value)}
          className={selectClass}
        >
          <option value="">Compound + isolation</option>
          {MOVEMENT_TYPE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className={selectClass}
        >
          <option value="">All levels</option>
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        {total} exercise{total === 1 ? "" : "s"}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((ex) => {
          const isExpanded = expandedId === ex.id;
          return (
            <button
              key={ex.id}
              onClick={() => setExpandedId(isExpanded ? null : ex.id)}
              className={`rounded-xl border p-4 text-left transition ${
                isExpanded
                  ? "col-span-full border-violet-400 bg-neutral-900"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{ex.name}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${difficultyColor[ex.difficulty]}`}
                >
                  {ex.difficulty}
                </span>
              </div>
              <p className="mt-1 text-xs capitalize text-neutral-500">
                {ex.category.replace("_", " ")} &middot; {ex.equipment.replace("_", " ")} &middot;{" "}
                {ex.movement_type}
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                {ex.primary_muscles.map(humanize).join(", ")}
                {ex.secondary_muscles.length > 0 && (
                  <span className="text-neutral-600">
                    {" "}
                    + {ex.secondary_muscles.map(humanize).join(", ")}
                  </span>
                )}
              </p>
              {isExpanded && ex.description && (
                <p className="mt-3 border-t border-neutral-800 pt-3 text-sm text-neutral-300">
                  {ex.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-6 text-center text-sm text-neutral-500">Loading...</p>}

      {!loading && items.length < total && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMore}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm transition hover:bg-neutral-800"
          >
            Load more
          </button>
        </div>
      )}
    </main>
  );
}
