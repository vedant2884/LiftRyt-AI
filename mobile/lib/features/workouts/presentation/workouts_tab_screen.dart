import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../splits/data/models.dart' as splits;
import '../../splits/data/splits_api.dart';
import '../../splits/presentation/splits_screen.dart';
import '../data/models.dart';
import '../data/providers.dart';
import '../state/active_workout_state.dart';
import '../state/progression_suggestions.dart';
import 'active_workout_screen.dart';

const _nameSuggestions = ['Push Day', 'Pull Day', 'Leg Day', 'Upper Body', 'Full Body', 'Arms'];

String _formatDate(DateTime d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${months[d.month - 1]} ${d.day}';
}

/// Mirrors `frontend/src/pages/WorkoutsPage.tsx` — quick-start card
/// (unchanged interaction model from web: name input + suggestion chips +
/// "use a previous workout") and workout history below it.
class WorkoutsTabScreen extends ConsumerStatefulWidget {
  const WorkoutsTabScreen({super.key});

  @override
  ConsumerState<WorkoutsTabScreen> createState() => _WorkoutsTabScreenState();
}

class _WorkoutsTabScreenState extends ConsumerState<WorkoutsTabScreen> {
  final _nameController = TextEditingController();
  List<WorkoutSummary> _workouts = [];
  splits.SplitPlan? _activeSplit;
  bool _loading = true;
  bool _starting = false;
  bool _pickingPrevious = false;

  @override
  void initState() {
    super.initState();
    _loadWorkouts();
    ref.read(splitsApiProvider).fetchActiveSplit().then((s) {
      if (mounted) setState(() => _activeSplit = s);
    }).catchError((_) {
      // No active split is a normal state — the quick-start card below
      // works fine without it.
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _loadWorkouts() async {
    try {
      final workouts = await ref.read(workoutsApiProvider).listWorkouts();
      if (mounted) {
        setState(() {
          _workouts = workouts;
          _loading = false;
        });
      }
    } on ApiException {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleStart(String workoutName, {String? copyFromId}) async {
    final trimmed = workoutName.trim();
    if (trimmed.isEmpty) return;
    setState(() => _starting = true);
    try {
      final controller = ref.read(activeWorkoutProvider.notifier);
      controller.startWorkout(trimmed);
      try {
        final sourceId = copyFromId ??
            _workouts.where((w) => w.name.trim().toLowerCase() == trimmed.toLowerCase()).firstOrNull?.id;
        if (sourceId != null) {
          final detail = await ref.read(workoutsApiProvider).getWorkout(sourceId);
          controller.prefillFromWorkout(detail);

          final progressions = await ref.read(progressionsApiProvider).fetchProgressions();
          for (final exercise in ref.read(activeWorkoutProvider).exercises) {
            await applySuggestionToExercise(ref, exercise.localId, exercise.exerciseId, progressions);
          }
        }
      } catch (_) {
        // Prefill is a nicety — starting blank is still a fully valid outcome.
      }
      if (mounted) {
        openActiveWorkout(context);
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isActive = ref.watch(activeWorkoutProvider).isActive;
    final activeName = ref.watch(activeWorkoutProvider).name;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadWorkouts,
          color: AppColors.accent,
          backgroundColor: AppColors.surface,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              const Text('Workouts',
                  style: TextStyle(color: AppColors.ink, fontSize: 24, fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              if (!isActive && _activeSplit?.todayDay != null) ...[
                _SplitCard(plan: _activeSplit!),
                const SizedBox(height: 12),
              ],
              if (isActive)
                AppCard(
                  borderColor: AppColors.accent.withValues(alpha: 0.4),
                  backgroundColor: AppColors.accent.withValues(alpha: 0.1),
                  onTap: () => openActiveWorkout(context),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Workout in progress',
                                style: TextStyle(color: AppColors.accent, fontSize: 12)),
                            const SizedBox(height: 2),
                            Text(activeName,
                                style: const TextStyle(color: AppColors.ink, fontSize: 15, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(8)),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.play_arrow_rounded, color: Colors.white, size: 16),
                            SizedBox(width: 4),
                            Text('Resume', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
              else
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Start a workout',
                          style: TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final s in _nameSuggestions)
                            _SuggestionChip(
                              label: s,
                              selected: _nameController.text == s,
                              onTap: () => setState(() => _nameController.text = s),
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _nameController,
                              decoration: const InputDecoration(hintText: 'Workout name'),
                              onSubmitted: (v) => _handleStart(v),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: _starting ? null : () => _handleStart(_nameController.text),
                            child: const Text('Start'),
                          ),
                        ],
                      ),
                      if (_workouts.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        TextButton.icon(
                          onPressed: () => setState(() => _pickingPrevious = !_pickingPrevious),
                          icon: const Icon(Icons.history_rounded, size: 14),
                          label: const Text('Use a previous workout instead', style: TextStyle(fontSize: 12)),
                          style: TextButton.styleFrom(foregroundColor: AppColors.inkSecondary, padding: EdgeInsets.zero),
                        ),
                      ],
                      if (_pickingPrevious)
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          constraints: const BoxConstraints(maxHeight: 200),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.line),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: ListView(
                            shrinkWrap: true,
                            children: [
                              for (final w in _workouts)
                                ListTile(
                                  dense: true,
                                  title: Text(w.name, style: const TextStyle(fontSize: 13)),
                                  trailing: Text(_formatDate(w.performedAt),
                                      style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
                                  onTap: () => _handleStart(w.name, copyFromId: w.id),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 20),
              const Row(
                children: [
                  Icon(Icons.history_rounded, color: AppColors.accent, size: 16),
                  SizedBox(width: 6),
                  Text('History', style: TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 10),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_workouts.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text('No workouts logged yet.', style: TextStyle(color: AppColors.inkMuted)),
                  ),
                )
              else
                for (final w in _workouts)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(w.name, overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
                                const SizedBox(height: 2),
                                Text(_formatDate(w.performedAt),
                                    style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
                              ],
                            ),
                          ),
                          Text('${w.setCount} sets · ${w.totalVolumeKg.round()} kg',
                              style: const TextStyle(color: AppColors.inkSecondary, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SuggestionChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _SuggestionChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.accent.withValues(alpha: 0.15) : null,
          border: Border.all(color: selected ? AppColors.accent : AppColors.lineStrong),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(color: selected ? AppColors.accent : AppColors.inkSecondary, fontSize: 12)),
      ),
    );
  }
}

class _SplitCard extends StatelessWidget {
  final splits.SplitPlan plan;

  const _SplitCard({required this.plan});

  @override
  Widget build(BuildContext context) {
    final today = plan.todayDay!;
    final upcoming = plan.upcoming();

    return AppCard(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SplitsScreen())),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your split · ${plan.splitType}', style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
          const SizedBox(height: 4),
          Text('Today: ${today.label}',
              style: const TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
          if (upcoming.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text('Up next: ${upcoming.map((d) => d.label).join(', ')}',
                style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
          ],
        ],
      ),
    );
  }
}
