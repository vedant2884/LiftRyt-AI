import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { addSet, deleteSet } from "../../api/workouts";
import { confirmProgression } from "../../api/progressions";
import { useActiveWorkoutStore, type DraftExercise } from "../../store/activeWorkoutStore";
import { toast } from "../../store/toastStore";
import PrConfirmPrompt from "./PrConfirmPrompt";
import SetRow from "./SetRow";

interface ActiveExerciseCardProps {
  exercise: DraftExercise;
  canMoveUp: boolean;
  canMoveDown: boolean;
  ensureWorkoutId: () => Promise<string>;
}

/** One exercise inside the active workout: header (name + reorder/remove)
 * and its set rows. Owns the "complete a set" flow — validates, lazily
 * creates the Workout row on the very first completed set anywhere in the
 * session (see ensureWorkoutId in ActiveWorkoutPage), posts the set, and
 * auto-appends the next set pre-filled with the same weight/reps so the
 * user isn't repeatedly tapping "Add set" between every set of the same
 * exercise. */
export default function ActiveExerciseCard({
  exercise,
  canMoveUp,
  canMoveDown,
  ensureWorkoutId,
}: ActiveExerciseCardProps) {
  const addSetDraft = useActiveWorkoutStore((s) => s.addSetDraft);
  const duplicateSet = useActiveWorkoutStore((s) => s.duplicateSet);
  const updateSetDraft = useActiveWorkoutStore((s) => s.updateSetDraft);
  const removeSetDraft = useActiveWorkoutStore((s) => s.removeSetDraft);
  const markSetSynced = useActiveWorkoutStore((s) => s.markSetSynced);
  const dismissPrPrompt = useActiveWorkoutStore((s) => s.dismissPrPrompt);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const moveExercise = useActiveWorkoutStore((s) => s.moveExercise);

  async function handleComplete(setLocalId: string) {
    const current = useActiveWorkoutStore
      .getState()
      .exercises.find((e) => e.localId === exercise.localId);
    const draftSet = current?.sets.find((s) => s.localId === setLocalId);
    if (!draftSet) return;

    const weight = Number(draftSet.weight);
    const reps = Number(draftSet.reps);
    if (!Number.isFinite(weight) || weight < 0 || !Number.isFinite(reps) || reps <= 0) {
      updateSetDraft(exercise.localId, setLocalId, { saveError: "Enter a valid weight and reps" });
      return;
    }

    updateSetDraft(exercise.localId, setLocalId, { saving: true, saveError: undefined });
    try {
      const workoutId = await ensureWorkoutId();
      const server = await addSet(workoutId, {
        exercise_id: exercise.exerciseId,
        custom_exercise_id: exercise.customExerciseId,
        weight_kg: weight,
        reps,
      });
      markSetSynced(exercise.localId, setLocalId, server);
      if (server.is_pr && server.suggested_increment_kg == null) {
        // Progression is either disabled for this exercise or unavailable
        // (a custom exercise) — still worth celebrating, just no "increase
        // next weight?" prompt to show alongside it.
        toast.success(`New PR — ${exercise.name}`);
      }

      const isLastSet = current!.sets[current!.sets.length - 1]?.localId === setLocalId;
      if (isLastSet) {
        addSetDraft(exercise.localId, { weight: draftSet.weight, reps: draftSet.reps });
      }
    } catch {
      updateSetDraft(exercise.localId, setLocalId, {
        saving: false,
        saveError: "Couldn't save — tap to retry",
      });
    }
  }

  async function handleRemoveSet(setLocalId: string) {
    const draftSet = exercise.sets.find((s) => s.localId === setLocalId);
    if (!draftSet) return;
    if (draftSet.serverId) {
      const workoutId = useActiveWorkoutStore.getState().workoutId;
      if (workoutId) {
        try {
          await deleteSet(workoutId, draftSet.serverId);
        } catch {
          toast.error("Couldn't delete that set. Please try again.");
          return;
        }
      }
    }
    removeSetDraft(exercise.localId, setLocalId);
  }

  async function handlePrConfirm(setLocalId: string, prWeightKg: number) {
    if (!exercise.exerciseId) return;
    try {
      await confirmProgression({ exercise_id: exercise.exerciseId, pr_weight_kg: prWeightKg });
      toast.success("Next weight suggestion saved");
    } catch {
      toast.error("Couldn't save that. Please try again.");
    } finally {
      dismissPrPrompt(exercise.localId, setLocalId);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-medium">{exercise.name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => moveExercise(exercise.localId, "up")}
            disabled={!canMoveUp}
            aria-label="Move exercise up"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => moveExercise(exercise.localId, "down")}
            disabled={!canMoveDown}
            aria-label="Move exercise down"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={() => removeExercise(exercise.localId)}
            aria-label="Remove exercise"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {exercise.sets.length > 0 && (
        <div className="mb-1 flex items-center gap-2 px-2 text-[11px] uppercase tracking-wide text-ink-muted">
          <span className="w-5 text-center">#</span>
          <span className="w-16 text-center sm:w-20">Weight</span>
          <span className="w-16 text-center sm:w-20">Reps</span>
        </div>
      )}

      <div className="space-y-0.5">
        {exercise.sets.map((draftSet, i) => (
          <div key={draftSet.localId}>
            <SetRow
              set={draftSet}
              index={i}
              onChange={(patch) => updateSetDraft(exercise.localId, draftSet.localId, patch)}
              onComplete={() => handleComplete(draftSet.localId)}
              onDuplicate={() => duplicateSet(exercise.localId, draftSet.localId)}
              onRemove={() => handleRemoveSet(draftSet.localId)}
            />
            {draftSet.showPrPrompt && draftSet.suggestedIncrementKg != null && (
              <PrConfirmPrompt
                prWeightKg={Number(draftSet.weight)}
                incrementKg={draftSet.suggestedIncrementKg}
                onConfirm={() => handlePrConfirm(draftSet.localId, Number(draftSet.weight))}
                onDismiss={() => dismissPrPrompt(exercise.localId, draftSet.localId)}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addSetDraft(exercise.localId)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong py-2 text-xs font-medium text-ink-secondary transition hover:border-accent/50 hover:text-ink"
      >
        <Plus size={13} /> Add set
      </button>
    </div>
  );
}
