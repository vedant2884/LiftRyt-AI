import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models.dart';
import '../data/providers.dart';
import 'active_workout_state.dart';

/// Applies a pending "increase next weight?" suggestion to an exercise's
/// first draft set, then consumes it (one-shot — never shown again once
/// used). Shared between the two places an exercise can enter the active
/// workout: hand-picked from the exercise picker, or auto-seeded via
/// "start workout"/"use previous workout"'s history prefill. Mirrors
/// `frontend/src/lib/progressionSuggestions.ts`.
Future<void> applySuggestionToExercise(
  WidgetRef ref,
  String exerciseLocalId,
  String? realExerciseId,
  List<ExerciseProgression> progressions,
) async {
  if (realExerciseId == null) return;
  ExerciseProgression? suggestion;
  for (final p in progressions) {
    if (p.exerciseId == realExerciseId && p.nextSuggestedWeightKg != null) {
      suggestion = p;
      break;
    }
  }
  if (suggestion == null || suggestion.nextSuggestedWeightKg == null) return;

  final controller = ref.read(activeWorkoutProvider.notifier);
  final exercise = ref.read(activeWorkoutProvider).exercises.where((e) => e.localId == exerciseLocalId).firstOrNull;
  final seededSet = exercise?.sets.firstOrNull;
  if (seededSet != null) {
    controller.updateSetDraft(exerciseLocalId, seededSet.localId, weight: suggestion.nextSuggestedWeightKg.toString());
  }

  try {
    await ref.read(progressionsApiProvider).updateProgression(exerciseId: realExerciseId, clearSuggestion: true);
  } catch (_) {
    // Best-effort — the prefill already happened either way.
  }
}
