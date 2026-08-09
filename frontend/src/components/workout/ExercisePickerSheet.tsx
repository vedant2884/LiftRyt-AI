import { useEffect, useState } from "react";
import { Clock, Plus, Search, Star, X } from "lucide-react";
import { fetchExercises } from "../../api/exercises";
import { fetchFavorites } from "../../api/favorites";
import { createCustomExercise, fetchCustomExercises } from "../../api/customExercises";
import { fetchRecentExercises } from "../../api/workouts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { toast } from "../../store/toastStore";
import type { ExerciseCategory, MovementType } from "../../types/exercise";
import type { ExperienceLevel } from "../../types/user";

const CATEGORY_OPTIONS: ExerciseCategory[] = ["push", "pull", "legs", "upper", "lower", "full_body", "core"];
const MOVEMENT_OPTIONS: MovementType[] = ["compound", "isolation"];
const DIFFICULTY_OPTIONS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

const humanize = (s: string) => s.replace(/_/g, " ");

export interface PickedExercise {
  id: string;
  isCustom: boolean;
  name: string;
  primaryMuscles: string[];
  equipment: string;
}

interface PickerRow {
  id: string;
  isCustom: boolean;
  name: string;
  primary_muscles: string[];
  equipment: string;
}

interface ExercisePickerSheetProps {
  onSelect: (exercise: PickedExercise) => void;
  onClose: () => void;
}

const rowClass =
  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-surface-hover active:scale-[0.99]";

function Row({ row, onPick }: { row: PickerRow; onPick: (row: PickerRow) => void }) {
  return (
    <button type="button" onClick={() => onPick(row)} className={rowClass}>
      <span className="min-w-0 truncate">{row.name}</span>
      <span className="shrink-0 truncate text-xs capitalize text-ink-muted">
        {row.primary_muscles[0] ? humanize(row.primary_muscles[0]) : ""}
        {row.primary_muscles[0] && row.equipment ? " · " : ""}
        {humanize(row.equipment)}
      </span>
    </button>
  );
}

/** Exercise picker for the active workout: recent -> favorites -> search,
 * deliberately not the Library's full filter set — this needs to be fast
 * mid-workout, not exhaustive. Equipment/movement/difficulty filters stay
 * in the Library. */
export default function ExercisePickerSheet({ onSelect, onClose }: ExercisePickerSheetProps) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);

  const [recent, setRecent] = useState<PickerRow[]>([]);
  const [favorites, setFavorites] = useState<PickerRow[]>([]);
  const [searchResults, setSearchResults] = useState<PickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customMuscles, setCustomMuscles] = useState("");
  const [customEquipment, setCustomEquipment] = useState("");
  const [customMovement, setCustomMovement] = useState<MovementType>("compound");
  const [customCategory, setCustomCategory] = useState<ExerciseCategory>("push");
  const [customDifficulty, setCustomDifficulty] = useState<ExperienceLevel>("beginner");
  const [savingCustom, setSavingCustom] = useState(false);

  useEffect(() => {
    Promise.all([fetchRecentExercises(8), fetchFavorites()])
      .then(([recentRows, favoriteRows]) => {
        setRecent(
          recentRows.map((r) => ({
            id: r.id,
            isCustom: r.is_custom,
            name: r.name,
            primary_muscles: r.primary_muscles,
            equipment: r.equipment,
          })),
        );
        const recentIds = new Set(recentRows.map((r) => `${r.is_custom}:${r.id}`));
        setFavorites(
          favoriteRows
            .filter((f) => !recentIds.has(`${f.is_custom}:${f.is_custom ? f.custom_exercise_id : f.exercise_id}`))
            .map((f) => ({
              id: (f.is_custom ? f.custom_exercise_id : f.exercise_id) as string,
              isCustom: f.is_custom,
              name: f.name,
              primary_muscles: f.primary_muscles,
              equipment: f.equipment,
            })),
        );
      })
      .catch(() => toast.error("Couldn't load exercises. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!debouncedQ.trim()) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    Promise.all([
      fetchExercises({ q: debouncedQ, limit: 12 }),
      fetchCustomExercises({ q: debouncedQ }),
    ])
      .then(([exerciseRes, customRes]) => {
        if (cancelled) return;
        setSearchResults([
          ...customRes.map((c) => ({
            id: c.id,
            isCustom: true,
            name: c.name,
            primary_muscles: c.primary_muscles,
            equipment: c.equipment,
          })),
          ...exerciseRes.items.map((e) => ({
            id: e.id,
            isCustom: false,
            name: e.name,
            primary_muscles: e.primary_muscles,
            equipment: e.equipment,
          })),
        ]);
      })
      .catch(() => {
        if (!cancelled) toast.error("Search failed. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  function handlePick(row: PickerRow) {
    onSelect({
      id: row.id,
      isCustom: row.isCustom,
      name: row.name,
      primaryMuscles: row.primary_muscles,
      equipment: row.equipment,
    });
  }

  async function handleCreateCustom() {
    const muscles = customMuscles
      .split(",")
      .map((m) => m.trim().toLowerCase().replace(/\s+/g, "_"))
      .filter(Boolean);
    if (!customName.trim() || muscles.length === 0 || !customEquipment.trim()) {
      toast.error("Name, at least one muscle, and equipment are required.");
      return;
    }
    setSavingCustom(true);
    try {
      const created = await createCustomExercise({
        name: customName.trim(),
        primary_muscles: muscles,
        equipment: customEquipment.trim(),
        movement_type: customMovement,
        category: customCategory,
        difficulty: customDifficulty,
      });
      toast.success("Custom exercise added");
      onSelect({
        id: created.id,
        isCustom: true,
        name: created.name,
        primaryMuscles: created.primary_muscles,
        equipment: created.equipment,
      });
    } catch {
      toast.error("Couldn't create that exercise. Please try again.");
    } finally {
      setSavingCustom(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div
        className="flex max-h-[85svh] w-full flex-col rounded-t-2xl border border-line bg-surface sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-medium">Add exercise</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-muted transition hover:bg-surface-hover"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-line p-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search exercises..."
              className="w-full rounded-md border border-line-strong bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {q.trim() ? (
            <>
              {searching && <p className="px-3 py-2 text-xs text-ink-muted">Searching...</p>}
              {!searching && searchResults.length === 0 && (
                <p className="px-3 py-2 text-xs text-ink-muted">No matches.</p>
              )}
              {searchResults.map((row) => (
                <Row key={`${row.isCustom}-${row.id}`} row={row} onPick={handlePick} />
              ))}
            </>
          ) : (
            <>
              {loading && <p className="px-3 py-2 text-xs text-ink-muted">Loading...</p>}
              {!loading && recent.length > 0 && (
                <div className="mb-2">
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-muted">
                    <Clock size={12} /> Recent
                  </p>
                  {recent.map((row) => (
                    <Row key={`${row.isCustom}-${row.id}`} row={row} onPick={handlePick} />
                  ))}
                </div>
              )}
              {!loading && favorites.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-muted">
                    <Star size={12} /> Favorites
                  </p>
                  {favorites.map((row) => (
                    <Row key={`${row.isCustom}-${row.id}`} row={row} onPick={handlePick} />
                  ))}
                </div>
              )}
              {!loading && recent.length === 0 && favorites.length === 0 && (
                <p className="px-3 py-2 text-xs text-ink-muted">
                  Search above, or add your own exercise below.
                </p>
              )}
            </>
          )}
        </div>

        <div className="border-t border-line p-3">
          {!creatingCustom ? (
            <button
              type="button"
              onClick={() => {
                setCreatingCustom(true);
                setCustomName(q);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-sm font-medium transition hover:bg-surface-hover active:scale-[0.98]"
            >
              <Plus size={15} /> Add your own exercise
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Exercise name"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                value={customMuscles}
                onChange={(e) => setCustomMuscles(e.target.value)}
                placeholder="Primary muscles (comma-separated)"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                value={customEquipment}
                onChange={(e) => setCustomEquipment(e.target.value)}
                placeholder="Equipment"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={customMovement}
                  onChange={(e) => setCustomMovement(e.target.value as MovementType)}
                  className="rounded-md border border-line-strong bg-bg px-2 py-2 text-xs outline-none focus:border-accent"
                >
                  {MOVEMENT_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {humanize(m)}
                    </option>
                  ))}
                </select>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as ExerciseCategory)}
                  className="rounded-md border border-line-strong bg-bg px-2 py-2 text-xs outline-none focus:border-accent"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ))}
                </select>
                <select
                  value={customDifficulty}
                  onChange={(e) => setCustomDifficulty(e.target.value as ExperienceLevel)}
                  className="rounded-md border border-line-strong bg-bg px-2 py-2 text-xs outline-none focus:border-accent"
                >
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {humanize(d)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateCustom}
                  disabled={savingCustom}
                  className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  {savingCustom ? "Adding..." : "Add & use"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingCustom(false)}
                  className="rounded-md border border-line-strong px-3 py-2 text-sm transition hover:bg-surface-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
