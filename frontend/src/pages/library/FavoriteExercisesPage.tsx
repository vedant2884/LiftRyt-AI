import { type DragEvent, useEffect, useMemo, useState } from "react";
import { GripVertical, Heart, X } from "lucide-react";
import { fetchFavorites, reorderFavorites, removeFavorite } from "../../api/favorites";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton } from "../../components/Skeleton";
import { toast } from "../../store/toastStore";
import type { FavoriteExercise } from "../../types/library";

const CATEGORY_OPTIONS = ["push", "pull", "legs", "upper", "lower", "full_body", "core"];

const selectClass =
  "rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

const humanize = (s: string) => s.replace(/_/g, " ");

export default function FavoriteExercisesPage() {
  const [favorites, setFavorites] = useState<FavoriteExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    fetchFavorites()
      .then(setFavorites)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return favorites.filter((f) => {
      if (category && f.category !== category) return false;
      if (q && !f.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [favorites, q, category]);

  async function handleRemove(favorite: FavoriteExercise) {
    await removeFavorite(favorite.id);
    setFavorites((prev) => prev.filter((f) => f.id !== favorite.id));
  }

  function handleDragStart(id: string) {
    setDragId(id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setFavorites((prev) => {
      const dragIndex = prev.findIndex((f) => f.id === dragId);
      const overIndex = prev.findIndex((f) => f.id === overId);
      if (dragIndex === -1 || overIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
  }

  async function handleDragEnd() {
    setDragId(null);
    try {
      await reorderFavorites(favorites.map((f) => f.id));
    } catch {
      toast.error("Couldn't save the new order. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        message="No favorites yet. Star exercises in the Exercise Library to build your quick-access list."
        actionLabel="Browse the library"
        to="/library"
      />
    );
  }

  return (
    <div>
      <p className="mb-6 text-sm text-ink-muted">
        Drag to reorder. The AI Coach prioritizes these when it builds a split for you, unless you ask
        for something specific.
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search favorites..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[240px] flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((favorite) => (
          <div
            key={favorite.id}
            draggable
            onDragStart={() => handleDragStart(favorite.id)}
            onDragOver={(e) => handleDragOver(e, favorite.id)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition ${
              dragId === favorite.id ? "opacity-50" : "hover:border-line-strong"
            }`}
          >
            <GripVertical size={16} className="shrink-0 cursor-grab text-ink-muted active:cursor-grabbing" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{favorite.name}</p>
                {favorite.is_custom && (
                  <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-400">
                    Custom
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-ink-muted">
                {humanize(favorite.category)} &middot; {favorite.primary_muscles.map(humanize).join(", ")}
              </p>
            </div>
            <button
              onClick={() => handleRemove(favorite)}
              aria-label="Remove from favorites"
              className="shrink-0 rounded-full p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-red-400 active:scale-90"
            >
              <X size={16} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">No favorites match your filters.</p>
        )}
      </div>
    </div>
  );
}
