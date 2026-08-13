import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../navigation/presentation/main_shell.dart';
import '../data/models.dart';
import '../data/providers.dart';
import '../state/active_workout_state.dart';
import '../state/progression_suggestions.dart';
import 'widgets/active_exercise_card.dart';
import 'widgets/exercise_picker_sheet.dart';
import 'widgets/rest_timer.dart';
import 'widgets/workout_summary_bar.dart';

/// Mirrors `frontend/src/pages/ActiveWorkoutPage.tsx` — same flow, mobile
/// layout. Pushed as a full route (not a bottom-nav tab) so a live logging
/// session doesn't show tab chrome, matching the web app's equivalent
/// full-page treatment.
class ActiveWorkoutScreen extends ConsumerStatefulWidget {
  const ActiveWorkoutScreen({super.key});

  @override
  ConsumerState<ActiveWorkoutScreen> createState() => _ActiveWorkoutScreenState();
}

class _ActiveWorkoutScreenState extends ConsumerState<ActiveWorkoutScreen> {
  List<ExerciseProgression> _progressions = [];
  bool _confirmingDiscard = false;
  bool _finishing = false;
  Future<String>? _creatingWorkout;
  bool _wasPrefilled = false;

  @override
  void initState() {
    super.initState();
    ref.read(activeWorkoutProvider.notifier).resetStaleSaving();
    _wasPrefilled = ref.read(activeWorkoutProvider).exercises.isNotEmpty;
    ref.read(progressionsApiProvider).fetchProgressions().then((p) {
      if (mounted) setState(() => _progressions = p);
    }).catchError((_) {
      // A missed suggested-weight prefill is a nicety lost, not a broken workflow.
    });
  }

  Future<String> _ensureWorkoutId() async {
    final current = ref.read(activeWorkoutProvider).workoutId;
    if (current != null) return current;
    _creatingWorkout ??= () async {
      final workout = ref.read(activeWorkoutProvider);
      final created = await ref.read(workoutsApiProvider).createWorkout(
            name: workout.name,
            performedAt: workout.startedAt!,
          );
      ref.read(activeWorkoutProvider.notifier).setWorkoutId(created.id);
      return created.id;
    }();
    try {
      return await _creatingWorkout!;
    } finally {
      _creatingWorkout = null;
    }
  }

  Future<void> _handleFinish() async {
    setState(() => _finishing = true);
    final workout = ref.read(activeWorkoutProvider);
    final controller = ref.read(activeWorkoutProvider.notifier);
    try {
      final id = workout.workoutId;
      if (id != null) {
        final durationSeconds = DateTime.now().difference(workout.startedAt!).inSeconds.clamp(0, 1 << 30);
        await ref.read(workoutsApiProvider).updateWorkout(id, durationSeconds: durationSeconds);
        controller.discard();
        if (mounted) Navigator.of(context).pop();
      } else {
        controller.discard();
        if (mounted) Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _finishing = false);
    }
  }

  Future<void> _handleDiscard() async {
    final workout = ref.read(activeWorkoutProvider);
    final controller = ref.read(activeWorkoutProvider.notifier);
    try {
      if (workout.workoutId != null) {
        await ref.read(workoutsApiProvider).deleteWorkout(workout.workoutId!);
      }
      controller.discard();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _handleAddExercise() async {
    final picked = await showExercisePickerSheet(context);
    if (picked == null) return;
    final controller = ref.read(activeWorkoutProvider.notifier);
    final localId = controller.addExercise(picked);
    await applySuggestionToExercise(ref, localId, picked.isCustom ? null : picked.id, _progressions);
    setState(() {
      _progressions = _progressions.where((p) => p.exerciseId != picked.id).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final workout = ref.watch(activeWorkoutProvider);

    if (!workout.isActive || workout.startedAt == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).pop();
      });
      return const Scaffold(body: SizedBox.shrink());
    }

    final totalSets = workout.exercises.fold<int>(0, (sum, e) => sum + e.sets.where((s) => s.completed).length);
    final totalVolume = workout.exercises.fold<double>(
      0,
      (sum, e) =>
          sum +
          e.sets.where((s) => s.completed).fold<double>(
              0, (exSum, s) => exSum + (double.tryParse(s.weight) ?? 0) * (double.tryParse(s.reps) ?? 0)),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(workout.name, style: const TextStyle(fontSize: 17)),
        actions: [
          if (_confirmingDiscard)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                children: [
                  TextButton(onPressed: _handleDiscard, child: const Text('Discard', style: TextStyle(color: Color(0xFFF87171)))),
                  TextButton(
                    onPressed: () => setState(() => _confirmingDiscard = false),
                    child: const Text('Cancel'),
                  ),
                ],
              ),
            )
          else
            TextButton.icon(
              onPressed: () => setState(() => _confirmingDiscard = true),
              icon: const Icon(Icons.close_rounded, size: 16),
              label: const Text('Discard'),
              style: TextButton.styleFrom(foregroundColor: AppColors.inkMuted),
            ),
        ],
      ),
      body: Column(
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.line),
            ),
            child: const RestTimer(),
          ),
          if (_wasPrefilled && workout.exercises.isNotEmpty)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surface.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Prefilled from your last ${workout.name}.',
                        style: const TextStyle(color: AppColors.inkSecondary, fontSize: 12)),
                  ),
                  TextButton(
                    onPressed: () {
                      ref.read(activeWorkoutProvider.notifier).clearExercises();
                      setState(() => _wasPrefilled = false);
                    },
                    child: const Text('Clear & start blank', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              children: [
                for (var i = 0; i < workout.exercises.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: ActiveExerciseCard(
                      key: ValueKey(workout.exercises[i].localId),
                      exercise: workout.exercises[i],
                      canMoveUp: i > 0,
                      canMoveDown: i < workout.exercises.length - 1,
                      ensureWorkoutId: _ensureWorkoutId,
                    ),
                  ),
                OutlinedButton.icon(
                  onPressed: _handleAddExercise,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Add exercise'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 48),
                    side: const BorderSide(color: AppColors.lineStrong),
                  ),
                ),
              ],
            ),
          ),
          WorkoutSummaryBar(
            startedAt: workout.startedAt!,
            totalSets: totalSets,
            totalVolumeKg: totalVolume,
            onFinish: _handleFinish,
            finishing: _finishing,
          ),
        ],
      ),
    );
  }
}

/// Pushes the active workout as a full-screen route from anywhere (e.g. the
/// Workouts tab, or the dashboard's quick-start card).
void openActiveWorkout(BuildContext context) {
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ActiveWorkoutScreen()));
}

/// Convenience used by the dashboard's quick-start card: switches to the
/// Workouts tab rather than pushing directly, so back-navigation lands on
/// the tab, not the previous screen.
void goToWorkoutsTab(WidgetRef ref) {
  ref.read(selectedTabProvider.notifier).state = 1;
}
