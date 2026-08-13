import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../workouts/presentation/active_workout_screen.dart';
import '../../workouts/state/active_workout_state.dart';
import '../data/models.dart';
import '../data/splits_api.dart';

String _humanize(String s) => s.replaceAll('_', ' ');

/// Preferred/active split management — view saved splits, generate a new
/// one, switch which is preferred, and jump straight into today's day.
/// Pushed from the Workouts tab's "Your split" card; reuses the existing
/// split-generation backend rather than a second engine.
class SplitsScreen extends ConsumerStatefulWidget {
  const SplitsScreen({super.key});

  @override
  ConsumerState<SplitsScreen> createState() => _SplitsScreenState();
}

class _SplitsScreenState extends ConsumerState<SplitsScreen> {
  SplitPlan? _active;
  List<SplitSummary> _saved = [];
  bool _loading = true;
  bool _generating = false;
  int _daysPerWeek = 4;
  String _experience = 'intermediate';
  String _goal = 'hypertrophy';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(splitsApiProvider);
      final active = await api.fetchActiveSplit();
      final saved = await api.listSplits();
      if (mounted) {
        setState(() {
          _active = active;
          _saved = saved;
          _loading = false;
        });
      }
    } on ApiException {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _generate() async {
    setState(() => _generating = true);
    try {
      final plan = await ref.read(splitsApiProvider).generateSplit(
            daysPerWeek: _daysPerWeek,
            experienceLevel: _experience,
            goal: _goal,
          );
      if (mounted) {
        setState(() => _active = plan);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Split generated')));
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _activate(String splitId) async {
    try {
      final plan = await ref.read(splitsApiProvider).activateSplit(splitId);
      if (mounted) {
        setState(() => _active = plan);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Preferred split updated')));
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _toggleDay(int dayNumber) async {
    if (_active == null) return;
    try {
      await ref.read(splitsApiProvider).toggleDayComplete(_active!.id, dayNumber);
      _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Starts a workout prefilled with this split day's exercises — a
  /// convenience default, never forced (the Workouts tab's own "Start a
  /// workout" card still starts a fully manual/blank session).
  void _startDay(SplitDay day) {
    final controller = ref.read(activeWorkoutProvider.notifier);
    controller.startWorkout(day.label);
    for (final ex in day.exercises) {
      controller.addExercise(ExerciseRef(
        id: ex.exerciseId,
        isCustom: false,
        name: ex.name,
        primaryMuscles: const [],
        equipment: '',
      ));
    }
    openActiveWorkout(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Splits')),
      body: SafeArea(child: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.accent,
              backgroundColor: AppColors.surface,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_active != null) ..._activeSplitSection(_active!),
                  const SizedBox(height: 20),
                  _generateSection(),
                  if (_saved.length > 1) ...[
                    const SizedBox(height: 20),
                    _savedSplitsSection(),
                  ],
                ],
              ),
            ),
      ),
    );
  }

  List<Widget> _activeSplitSection(SplitPlan plan) {
    final today = plan.todayDay;
    return [
      const Text('Active split', style: TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
      const SizedBox(height: 10),
      AppCard(
        borderColor: AppColors.accent.withValues(alpha: 0.4),
        backgroundColor: AppColors.accent.withValues(alpha: 0.08),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${plan.splitType} · ${plan.daysPerWeek} days/week',
                style: const TextStyle(color: AppColors.accent, fontSize: 12)),
            const SizedBox(height: 6),
            if (today != null) ...[
              Text('Today: ${today.label}',
                  style: const TextStyle(color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              ElevatedButton.icon(
                onPressed: () => _startDay(today),
                icon: const Icon(Icons.play_arrow_rounded, size: 16),
                label: Text('Start ${today.label}'),
              ),
              if (plan.upcoming().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Up next: ${plan.upcoming().map((d) => d.label).join(', ')}',
                    style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
              ],
            ],
          ],
        ),
      ),
      const SizedBox(height: 12),
      for (final day in plan.days)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AppCard(
            padding: const EdgeInsets.all(12),
            borderColor: plan.completedDayNumbers.contains(day.dayNumber)
                ? const Color(0xFF34D399).withValues(alpha: 0.4)
                : AppColors.line,
            backgroundColor:
                plan.completedDayNumbers.contains(day.dayNumber) ? const Color(0xFF34D399).withValues(alpha: 0.05) : null,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('Day ${day.dayNumber}: ${day.label}',
                          style: const TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
                    ),
                    IconButton(
                      onPressed: () => _toggleDay(day.dayNumber),
                      icon: Icon(
                        plan.completedDayNumbers.contains(day.dayNumber)
                            ? Icons.check_circle_rounded
                            : Icons.check_circle_outline_rounded,
                        size: 20,
                        color: plan.completedDayNumbers.contains(day.dayNumber)
                            ? const Color(0xFF34D399)
                            : AppColors.inkMuted,
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
                for (final ex in day.exercises)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('${ex.name} · ${ex.sets}×${ex.reps}',
                        style: const TextStyle(color: AppColors.inkSecondary, fontSize: 12)),
                  ),
              ],
            ),
          ),
        ),
    ];
  }

  Widget _generateSection() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_active == null ? 'Generate your first split' : 'Generate a new split',
              style: const TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  initialValue: _daysPerWeek,
                  decoration: const InputDecoration(isDense: true, labelText: 'Days/week'),
                  items: [for (final d in [1, 2, 3, 4, 5, 6]) DropdownMenuItem(value: d, child: Text('$d'))],
                  onChanged: (v) => setState(() => _daysPerWeek = v ?? 4),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _experience,
                  decoration: const InputDecoration(isDense: true, labelText: 'Level'),
                  items: const [
                    DropdownMenuItem(value: 'beginner', child: Text('Beginner')),
                    DropdownMenuItem(value: 'intermediate', child: Text('Intermediate')),
                    DropdownMenuItem(value: 'advanced', child: Text('Advanced')),
                  ],
                  onChanged: (v) => setState(() => _experience = v ?? 'intermediate'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _goal,
            decoration: const InputDecoration(isDense: true, labelText: 'Goal'),
            items: const [
              DropdownMenuItem(value: 'strength', child: Text('Strength')),
              DropdownMenuItem(value: 'hypertrophy', child: Text('Hypertrophy')),
              DropdownMenuItem(value: 'general_fitness', child: Text('General fitness')),
            ],
            onChanged: (v) => setState(() => _goal = v ?? 'hypertrophy'),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _generating ? null : _generate,
              child: Text(_generating ? 'Generating...' : 'Generate split'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _savedSplitsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Your splits', style: TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 10),
        for (final s in _saved)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              padding: const EdgeInsets.all(12),
              borderColor: s.isActive ? AppColors.accent.withValues(alpha: 0.4) : AppColors.line,
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${s.splitType} · ${s.daysPerWeek} days/week',
                            style: const TextStyle(color: AppColors.ink, fontSize: 13, fontWeight: FontWeight.w600)),
                        Text(_humanize(s.goal), style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
                      ],
                    ),
                  ),
                  if (s.isActive)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                          color: AppColors.accent.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
                      child: const Text('Preferred', style: TextStyle(color: AppColors.accent, fontSize: 11)),
                    )
                  else
                    OutlinedButton(
                      onPressed: () => _activate(s.id),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('Set as preferred', style: TextStyle(fontSize: 11)),
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
