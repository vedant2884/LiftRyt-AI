import { useEffect, useState } from "react";
import { SearchX } from "lucide-react";
import { createChatSession } from "../../api/chat";
import {
  fetchEquipmentOptions,
  fetchExercises,
  fetchExercisesSemantic,
  fetchMuscleOptions,
} from "../../api/exercises";
import { addFavorite, fetchFavorites, removeFavorite } from "../../api/favorites";
import { EmptyState } from "../../components/EmptyState";
import ExerciseCard from "../../components/library/ExerciseCard";
import { ExerciseDetailModalRoot } from "../../components/library/ExerciseDetailModal";
import { Skeleton } from "../../components/Skeleton";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { toast } from "../../store/toastStore";
import type { Exercise } from "../../types/exercise";

const PAGE_SIZE = 24;

const CATEGORY_OPTIONS = ["push", "pull", "legs", "upper", "lower", "full_body", "core"];
const MOVEMENT_TYPE_OPTIONS = ["compound", "isolation"];
const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"];

type SearchMode = "keyword" | "semantic";

const selectClass =
  "rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-40";

export default function ExerciseLibraryPage() {
  const [mode, setMode] = useState<SearchMode>("keyword");
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
  const [initialLoad, setInitialLoad] = useState(true);
  const [openExercise, setOpenExercise] = useState<Exercise | null>(null);

  // exercise_id -> favorite row id, so a heart click knows whether to add
  // or remove and which favorite row to delete.
  const [favoriteMap, setFavoriteMap] = useState<Map<string, string>>(new Map());

  // Lazily created and reused across every "Ask Coach" question asked from
  // any exercise's detail modal during this page visit, so they land in one
  // real Coach session instead of littering a new thread per question.
  const [coachSessionId, setCoachSessionId] = useState<string | null>(null);

  function clearFilters() {
    setQ("");
    setMuscle("");
    setEquipment("");
    setCategory("");
    setMovementType("");
    setDifficulty("");
  }

  useEffect(() => {
    fetchMuscleOptions().then(setMuscleOptions);
    fetchEquipmentOptions().then(setEquipmentOptions);
    fetchFavorites().then((favorites) => {
      setFavoriteMap(
        new Map(favorites.filter((f) => f.exercise_id).map((f) => [f.exercise_id as string, f.id])),
      );
    });
  }, []);

  // Semantic mode: only the query matters (the endpoint doesn't take
  // filters), and there's no pagination — it's a fixed top-N similarity list.
  useEffect(() => {
    if (mode !== "semantic") return;
    if (!debouncedQ.trim()) {
      setItems([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchExercisesSemantic(debouncedQ, PAGE_SIZE).then((results) => {
      if (cancelled) return;
      setItems(results);
      setTotal(results.length);
      setLoading(false);
      setInitialLoad(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, debouncedQ]);

  // Keyword mode: any filter change starts a fresh search (offset 0).
  useEffect(() => {
    if (mode !== "keyword") return;
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
      setInitialLoad(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, debouncedQ, muscle, equipment, category, movementType, difficulty]);

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

  async function toggleFavorite(exerciseId: string) {
    const existingFavoriteId = favoriteMap.get(exerciseId);
    if (existingFavoriteId) {
      await removeFavorite(existingFavoriteId);
      setFavoriteMap((prev) => {
        const next = new Map(prev);
        next.delete(exerciseId);
        return next;
      });
    } else {
      const favorite = await addFavorite({ exercise_id: exerciseId });
      setFavoriteMap((prev) => new Map(prev).set(exerciseId, favorite.id));
      toast.success("Added to favorites");
    }
  }

  async function ensureCoachSession(): Promise<string> {
    if (coachSessionId) return coachSessionId;
    const session = await createChatSession();
    setCoachSessionId(session.id);
    return session.id;
  }

  return (
    <div>
      <p className="mb-6 text-sm text-ink-muted">
        {mode === "keyword"
          ? "Keyword search. Matches text in the name or description."
          : "Semantic search. Finds exercises by meaning, even when your words don't literally appear anywhere."}
      </p>

      <div className="mb-4 inline-flex rounded-lg border border-line bg-surface p-1">
        <button
          onClick={() => setMode("keyword")}
          className={`rounded-md px-3 py-1.5 text-sm transition ${
            mode === "keyword" ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
          }`}
        >
          Keyword
        </button>
        <button
          onClick={() => setMode("semantic")}
          className={`rounded-md px-3 py-1.5 text-sm transition ${
            mode === "semantic" ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
          }`}
        >
          Semantic
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder={
            mode === "keyword" ? "Search exercises..." : "Describe what you need, e.g. \"sore lower back\"..."
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[240px] flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          disabled={mode === "semantic"}
          className={selectClass}
        >
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
          disabled={mode === "semantic"}
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
          disabled={mode === "semantic"}
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
          disabled={mode === "semantic"}
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
          disabled={mode === "semantic"}
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

      <p className="mb-4 text-sm text-ink-muted">
        {mode === "semantic" && !debouncedQ.trim()
          ? "Type a description above to search"
          : `${total} exercise${total === 1 ? "" : "s"}`}
      </p>

      {loading && items.length === 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="aspect-[4/3] w-full animate-pulse bg-surface-hover" />
              <div className="p-3.5">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !initialLoad && items.length === 0 && (mode === "keyword" || debouncedQ.trim()) && (
        <EmptyState
          icon={SearchX}
          message="No exercises match your filters."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(!loading || items.length > 0) &&
          items.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              isFavorited={favoriteMap.has(ex.id)}
              onToggleFavorite={toggleFavorite}
              onOpen={setOpenExercise}
            />
          ))}
      </div>

      {loading && items.length > 0 && (
        <p className="mt-6 text-center text-sm text-ink-muted">Loading more...</p>
      )}

      {!loading && mode === "keyword" && items.length < total && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMore}
            className="rounded-md border border-line-strong px-4 py-2 text-sm transition hover:bg-surface-hover active:scale-[0.97]"
          >
            Load more
          </button>
        </div>
      )}

      <ExerciseDetailModalRoot
        exercise={openExercise}
        isFavorited={openExercise ? favoriteMap.has(openExercise.id) : false}
        onToggleFavorite={toggleFavorite}
        onClose={() => setOpenExercise(null)}
        onSelectAlternative={setOpenExercise}
        ensureCoachSession={ensureCoachSession}
      />
    </div>
  );
}
