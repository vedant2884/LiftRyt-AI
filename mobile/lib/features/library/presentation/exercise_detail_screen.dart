import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../analysis/data/analysis_api.dart';
import '../../analysis/data/models.dart';
import '../data/models.dart';

String _humanize(String s) => s.replaceAll('_', ' ');

/// Exercise detail — info + performance stats in separate sections rather
/// than one crowded screen. Progression stats reuse the existing Analysis
/// endpoint (only shown for non-custom exercises the user has actually
/// logged, since progression tracking keys off the real `exercise_id`).
class ExerciseDetailScreen extends ConsumerStatefulWidget {
  final LibraryExercise exercise;

  const ExerciseDetailScreen({super.key, required this.exercise});

  @override
  ConsumerState<ExerciseDetailScreen> createState() => _ExerciseDetailScreenState();
}

class _ExerciseDetailScreenState extends ConsumerState<ExerciseDetailScreen> {
  ExerciseProgressionStats? _stats;
  bool _loading = false;
  bool _hasHistory = true;

  @override
  void initState() {
    super.initState();
    if (!widget.exercise.isCustom) _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() => _loading = true);
    try {
      final stats = await ref.read(analysisApiProvider).fetchExerciseProgression(widget.exercise.id);
      if (mounted) setState(() => _stats = stats);
    } on ApiException {
      if (mounted) setState(() => _hasHistory = false);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ex = widget.exercise;
    return Scaffold(
      appBar: AppBar(title: Text(ex.name, style: const TextStyle(fontSize: 16))),
      body: SafeArea(
        child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _tag(_humanize(ex.category)),
              _tag(_humanize(ex.movementType)),
              _tag(_humanize(ex.difficulty)),
              _tag(_humanize(ex.equipment)),
              for (final m in ex.primaryMuscles) _tag(_humanize(m), accent: true),
            ],
          ),
          if (ex.description != null && ex.description!.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(ex.description!, style: const TextStyle(color: AppColors.inkSecondary, fontSize: 13, height: 1.5)),
          ],
          if (!ex.isCustom) ...[
            const SizedBox(height: 20),
            const Text('Your performance', style: TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
            else if (!_hasHistory || _stats == null || _stats!.sessionCount == 0)
              const Text("You haven't logged this exercise yet.", style: TextStyle(color: AppColors.inkMuted, fontSize: 13))
            else
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_stats!.bestWeightKg != null)
                      _statRow('Best weight', '${_stats!.bestWeightKg} kg × ${_stats!.bestWeightReps}'),
                    if (_stats!.bestEstimated1RmKg != null)
                      _statRow('Est. 1RM', '${_stats!.bestEstimated1RmKg} kg (Epley estimate)'),
                    _statRow('Total volume', '${_stats!.totalVolumeKg.round()} kg'),
                    _statRow('Sessions', '${_stats!.sessionCount}'),
                    if (_stats!.lastPerformedAt != null)
                      _statRow('Last trained', _stats!.lastPerformedAt!.toIso8601String().split('T').first),
                  ],
                ),
              ),
          ],
        ],
        ),
      ),
    );
  }

  Widget _tag(String label, {bool accent = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: accent ? AppColors.accent.withValues(alpha: 0.12) : AppColors.surfaceHover,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: TextStyle(color: accent ? AppColors.accent : AppColors.inkSecondary, fontSize: 11)),
    );
  }

  Widget _statRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
          Text(value, style: const TextStyle(color: AppColors.ink, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
