import { updateProgression } from "../api/progressions";
import { useActiveWorkoutStore } from "../store/activeWorkoutStore";
import { toast } from "../store/toastStore";
import type { ExerciseProgression } from "../types/progression";

/** Applies a pending "increase next weight?" suggestion to an exercise's
 * first draft set, then consumes it (one-shot — never shown again once
 * used). Shared between the two places an exercise can enter the active
 * workout: picked explicitly from ExercisePickerSheet, or auto-seeded via
 * "start workout"/"use previous workout"'s history prefill — a pending
 * suggestion should surface either way, not just when hand-picked. */
export function applySuggestionToExercise(
  exerciseLocalId: string,
  realExerciseId: string | undefined,
  progressions: ExerciseProgression[],
): void {
  if (!realExerciseId) return;
  const suggestion = progressions.find(
    (p) => p.exercise_id === realExerciseId && p.next_suggested_weight_kg != null,
  );
  if (!suggestion || suggestion.next_suggested_weight_kg == null) return;

  const seededSet = useActiveWorkoutStore
    .getState()
    .exercises.find((e) => e.localId === exerciseLocalId)?.sets[0];
  if (seededSet) {
    useActiveWorkoutStore
      .getState()
      .updateSetDraft(exerciseLocalId, seededSet.localId, {
        weight: String(suggestion.next_suggested_weight_kg),
      });
  }

  updateProgression({ exercise_id: realExerciseId, clear_suggestion: true }).catch(() => {});
  toast.info(`Suggested weight: ${suggestion.next_suggested_weight_kg} kg`);
}
