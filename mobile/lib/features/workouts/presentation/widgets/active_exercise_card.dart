import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../data/providers.dart';
import '../../state/active_workout_state.dart';
import 'pr_confirm_prompt.dart';
import 'set_row.dart';

/// One exercise inside the active workout: header (name + reorder/remove)
/// and its set rows. Owns the "complete a set" flow — validates, lazily
/// creates the Workout row on the very first completed set anywhere in the
/// session (via `ensureWorkoutId`), posts the set, and auto-appends the
/// next set pre-filled with the same weight/reps so the user isn't
/// repeatedly tapping "Add set" between sets of the same exercise.
class ActiveExerciseCard extends ConsumerWidget {
  final DraftExercise exercise;
  final bool canMoveUp;
  final bool canMoveDown;
  final Future<String> Function() ensureWorkoutId;

  const ActiveExerciseCard({
    super.key,
    required this.exercise,
    required this.canMoveUp,
    required this.canMoveDown,
    required this.ensureWorkoutId,
  });

  Future<void> _handleComplete(BuildContext context, WidgetRef ref, String setLocalId) async {
    final controller = ref.read(activeWorkoutProvider.notifier);
    final current = ref
        .read(activeWorkoutProvider)
        .exercises
        .firstWhere((e) => e.localId == exercise.localId);
    final draftSet = current.sets.firstWhere((s) => s.localId == setLocalId);

    final weight = double.tryParse(draftSet.weight);
    final reps = int.tryParse(draftSet.reps);
    if (weight == null || weight < 0 || reps == null || reps <= 0) {
      controller.updateSetDraft(exercise.localId, setLocalId, saveError: 'Enter a valid weight and reps');
      return;
    }

    controller.updateSetDraft(exercise.localId, setLocalId, saving: true, saveError: null);
    try {
      final workoutId = await ensureWorkoutId();
      final server = await ref.read(workoutsApiProvider).addSet(
            workoutId: workoutId,
            exerciseId: exercise.exerciseId,
            customExerciseId: exercise.customExerciseId,
            weightKg: weight,
            reps: reps,
          );
      controller.markSetSynced(exercise.localId, setLocalId, server);

      if (server.isPr && server.suggestedIncrementKg == null && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('New PR — ${exercise.name}'), duration: const Duration(seconds: 2)),
        );
      }

      final isLastSet = current.sets.last.localId == setLocalId;
      if (isLastSet) {
        controller.addSetDraft(exercise.localId, weight: draftSet.weight, reps: draftSet.reps);
      }
    } on ApiException {
      controller.updateSetDraft(exercise.localId, setLocalId, saving: false, saveError: "Couldn't save — tap to retry");
    }
  }

  Future<void> _handleRemoveSet(WidgetRef ref, String setLocalId) async {
    final controller = ref.read(activeWorkoutProvider.notifier);
    final draftSet = exercise.sets.firstWhere((s) => s.localId == setLocalId);
    if (draftSet.serverId != null) {
      final workoutId = ref.read(activeWorkoutProvider).workoutId;
      if (workoutId != null) {
        try {
          await ref.read(workoutsApiProvider).deleteSet(workoutId, draftSet.serverId!);
        } on ApiException {
          return;
        }
      }
    }
    controller.removeSetDraft(exercise.localId, setLocalId);
  }

  Future<void> _handlePrConfirm(WidgetRef ref, String setLocalId, double prWeightKg) async {
    final controller = ref.read(activeWorkoutProvider.notifier);
    if (exercise.exerciseId == null) return;
    try {
      await ref.read(progressionsApiProvider).confirmProgression(
            exerciseId: exercise.exerciseId!,
            prWeightKg: prWeightKg,
          );
    } on ApiException {
      // Best-effort — the prompt still dismisses either way.
    } finally {
      controller.dismissPrPrompt(exercise.localId, setLocalId);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(activeWorkoutProvider.notifier);

    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(exercise.name,
                    style: const TextStyle(color: AppColors.ink, fontSize: 15, fontWeight: FontWeight.w600)),
              ),
              IconButton(
                onPressed: canMoveUp ? () => controller.moveExercise(exercise.localId, up: true) : null,
                icon: const Icon(Icons.keyboard_arrow_up_rounded, size: 20),
                color: AppColors.inkMuted,
                visualDensity: VisualDensity.compact,
              ),
              IconButton(
                onPressed: canMoveDown ? () => controller.moveExercise(exercise.localId, up: false) : null,
                icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 20),
                color: AppColors.inkMuted,
                visualDensity: VisualDensity.compact,
              ),
              IconButton(
                onPressed: () => controller.removeExercise(exercise.localId),
                icon: const Icon(Icons.close_rounded, size: 18),
                color: AppColors.inkMuted,
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          if (exercise.sets.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(left: 26, bottom: 2),
              child: Row(
                children: [
                  Expanded(
                      child: Text('WEIGHT',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.inkMuted, fontSize: 10, letterSpacing: 0.5))),
                  Expanded(
                      child: Text('REPS',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.inkMuted, fontSize: 10, letterSpacing: 0.5))),
                ],
              ),
            ),
          for (final draftSet in exercise.sets) ...[
            SetRow(
              key: ValueKey(draftSet.localId),
              set: draftSet,
              index: exercise.sets.indexOf(draftSet),
              onWeightChanged: (v) => controller.updateSetDraft(exercise.localId, draftSet.localId, weight: v),
              onRepsChanged: (v) => controller.updateSetDraft(exercise.localId, draftSet.localId, reps: v),
              onComplete: () => _handleComplete(context, ref, draftSet.localId),
              onDuplicate: () => controller.duplicateSet(exercise.localId, draftSet.localId),
              onRemove: () => _handleRemoveSet(ref, draftSet.localId),
            ),
            if (draftSet.saveError != null)
              Padding(
                padding: const EdgeInsets.only(left: 26, bottom: 4),
                child: Text(draftSet.saveError!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 11)),
              ),
            if (draftSet.showPrPrompt && draftSet.suggestedIncrementKg != null)
              PrConfirmPrompt(
                prWeightKg: double.tryParse(draftSet.weight) ?? 0,
                incrementKg: draftSet.suggestedIncrementKg!,
                onConfirm: () => _handlePrConfirm(ref, draftSet.localId, double.tryParse(draftSet.weight) ?? 0),
                onDismiss: () => controller.dismissPrPrompt(exercise.localId, draftSet.localId),
              ),
          ],
          const SizedBox(height: 6),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => controller.addSetDraft(exercise.localId),
              icon: const Icon(Icons.add_rounded, size: 16),
              label: const Text('Add set'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.inkSecondary,
                side: const BorderSide(color: AppColors.lineStrong, style: BorderStyle.solid),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
