import { Check, Copy, Loader2, Sparkles, Trash2 } from "lucide-react";
import type { DraftSet } from "../../store/activeWorkoutStore";

interface SetRowProps {
  set: DraftSet;
  index: number;
  onChange: (patch: Partial<DraftSet>) => void;
  onComplete: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const numberInputClass =
  "w-16 rounded-md border border-line-strong bg-bg px-2 py-1.5 text-center text-sm outline-none focus:border-accent disabled:opacity-60 sm:w-20";

/** One set inside an ActiveExerciseCard — weight/reps entry, Complete Set,
 * duplicate, remove, all inline. No modal, no separate page: the whole
 * point of the active workout screen is that logging a set never leaves
 * this row. */
export default function SetRow({ set, index, onChange, onComplete, onDuplicate, onRemove }: SetRowProps) {
  const canComplete = set.weight.trim() !== "" && set.reps.trim() !== "" && !set.saving;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
        set.completed ? "bg-emerald-500/[0.06]" : ""
      }`}
    >
      <span className="w-5 shrink-0 text-center text-xs text-ink-muted">{index + 1}</span>

      {set.completed ? (
        <>
          <span className="w-16 text-center text-sm text-ink sm:w-20">{set.weight} kg</span>
          <span className="w-16 text-center text-sm text-ink sm:w-20">{set.reps} reps</span>
        </>
      ) : (
        <>
          <input
            type="number"
            inputMode="decimal"
            value={set.weight}
            onChange={(e) => onChange({ weight: e.target.value })}
            placeholder="kg"
            className={numberInputClass}
          />
          <input
            type="number"
            inputMode="numeric"
            value={set.reps}
            onChange={(e) => onChange({ reps: e.target.value })}
            placeholder="reps"
            className={numberInputClass}
          />
        </>
      )}

      {set.isPr && (
        <span
          title="New personal record"
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
        >
          <Sparkles size={10} /> PR
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {set.saveError && <span className="text-[10px] text-red-400">{set.saveError}</span>}
        {!set.completed && (
          <button
            type="button"
            onClick={onComplete}
            disabled={!canComplete}
            aria-label="Complete set"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white transition hover:opacity-90 active:scale-90 disabled:opacity-40"
          >
            {set.saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          </button>
        )}
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Duplicate set"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-ink active:scale-90"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove set"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-red-400 active:scale-90"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
