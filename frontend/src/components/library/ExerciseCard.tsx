import { Heart } from "lucide-react";
import ExerciseMedia from "./ExerciseMedia";
import type { Exercise } from "../../types/exercise";

const humanize = (s: string) => s.replace(/_/g, " ");

interface ExerciseCardProps {
  exercise: Exercise;
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (exercise: Exercise) => void;
}

/** Visual-first: thumbnail, name, primary muscle, equipment, favorite.
 * No difficulty/category/movement-type chips and no description — those
 * live in the detail modal now. A `div[role=button]` rather than a real
 * `<button>` because the favorite heart is itself a real button, and
 * buttons can't nest. */
export default function ExerciseCard({ exercise, isFavorited, onToggleFavorite, onOpen }: ExerciseCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(exercise)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(exercise);
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-sm transition duration-300 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-xl hover:shadow-black/5"
    >
      <div className="relative aspect-[4/3] w-full shrink-0">
        <ExerciseMedia exercise={exercise} variant="card" className="h-full w-full" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(exercise.id);
          }}
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-bg/70 shadow-sm backdrop-blur-md transition hover:bg-bg/90 active:scale-90"
        >
          <Heart size={15} className={isFavorited ? "fill-accent text-accent" : "text-ink-secondary"} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-3.5 py-3">
        <h3 className="truncate text-sm font-medium text-ink">{exercise.name}</h3>
        <p className="truncate text-xs capitalize text-ink-muted">
          {humanize(exercise.primary_muscles[0] ?? exercise.category)} &middot; {humanize(exercise.equipment)}
        </p>
      </div>
    </div>
  );
}
