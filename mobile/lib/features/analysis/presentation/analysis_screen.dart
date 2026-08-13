import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../workouts/data/models.dart' show WorkoutSummary;
import '../../workouts/data/providers.dart';
import '../data/analysis_api.dart';
import '../data/models.dart';

String _fmtDate(DateTime d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${months[d.month - 1]} ${d.day}';
}

String _humanize(String s) => s.replaceAll('_', ' ');

class _Data {
  final WorkoutOverview overview;
  final List<PersonalRecord> prs;
  final List<WeeklyVolume> weeklyVolume;
  final List<MuscleVolume> muscleVolume;
  final List<WorkoutSummary> history;

  const _Data({
    required this.overview,
    required this.prs,
    required this.weeklyVolume,
    required this.muscleVolume,
    required this.history,
  });
}

/// Mirrors `frontend/src/pages/WorkoutAnalysisPage.tsx` section-for-section
/// (Overview / Personal Records / Exercise Progression / Volume / History) —
/// same backend endpoints, same numbers, mobile-native layout instead of
/// the web's wide grid.
class AnalysisScreen extends ConsumerStatefulWidget {
  const AnalysisScreen({super.key});

  @override
  ConsumerState<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends ConsumerState<AnalysisScreen> {
  late Future<_Data> _future;
  String? _selectedExerciseId;
  ExerciseProgressionStats? _progression;
  bool _progressionLoading = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Data> _load() async {
    final api = ref.read(analysisApiProvider);
    final results = await Future.wait([
      api.fetchOverview(),
      api.fetchPersonalRecords(),
      api.fetchWeeklyVolume(),
      api.fetchMuscleVolume(),
      api.fetchHistory(),
    ]);
    final data = _Data(
      overview: results[0] as WorkoutOverview,
      prs: results[1] as List<PersonalRecord>,
      weeklyVolume: results[2] as List<WeeklyVolume>,
      muscleVolume: results[3] as List<MuscleVolume>,
      history: results[4] as List<WorkoutSummary>,
    );
    if (data.prs.isNotEmpty && _selectedExerciseId == null) {
      _selectExercise(data.prs.first.exerciseId);
    }
    return data;
  }

  Future<void> _selectExercise(String exerciseId) async {
    setState(() {
      _selectedExerciseId = exerciseId;
      _progressionLoading = true;
    });
    try {
      final stats = await ref.read(analysisApiProvider).fetchExerciseProgression(exerciseId);
      if (mounted) setState(() => _progression = stats);
    } on ApiException {
      // Chart just stays empty — the rest of the page is still useful.
    } finally {
      if (mounted) setState(() => _progressionLoading = false);
    }
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _future = next);
    await next;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: AppColors.accent,
          backgroundColor: AppColors.surface,
          child: FutureBuilder<_Data>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return _errorState(
                  snapshot.error is ApiException
                      ? (snapshot.error as ApiException).message
                      : 'Something went wrong loading your analysis.',
                );
              }
              final data = snapshot.data!;
              if (data.overview.totalWorkouts == 0) {
                return _emptyState();
              }
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                children: [
                  const Text('Progress', style: TextStyle(color: AppColors.ink, fontSize: 24, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 16),
                  _sectionTitle(Icons.local_fire_department_rounded, 'Overview'),
                  _overviewGrid(data.overview),
                  const SizedBox(height: 24),
                  _sectionTitle(Icons.emoji_events_rounded, 'Personal records'),
                  _prList(data.prs),
                  const SizedBox(height: 24),
                  _sectionTitle(Icons.show_chart_rounded, 'Exercise progression'),
                  _progressionSection(data.prs),
                  const SizedBox(height: 24),
                  _sectionTitle(Icons.bar_chart_rounded, 'Volume'),
                  _volumeSection(data.weeklyVolume, data.muscleVolume),
                  const SizedBox(height: 24),
                  _sectionTitle(Icons.history_rounded, 'Workout history'),
                  _historyList(data.history),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(IconData icon, String title) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Icon(icon, color: AppColors.accent, size: 17),
            const SizedBox(width: 6),
            Text(title, style: const TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
          ],
        ),
      );

  Widget _overviewGrid(WorkoutOverview o) {
    final stats = [
      ('Total workouts', '${o.totalWorkouts}'),
      ('This week', '${o.workoutsThisWeek}'),
      ('This month', '${o.workoutsThisMonth}'),
      ('Total sets', '${o.totalSets}'),
      ('Total volume', '${o.totalVolumeKg.round()} kg'),
      ('Most trained muscle', o.mostTrainedMuscle != null ? _humanize(o.mostTrainedMuscle!) : '—'),
      ('Most trained exercise', o.mostTrainedExerciseName ?? '—'),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.7,
      children: [
        for (final (label, value) in stats)
          AppCard(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(label, style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
                const SizedBox(height: 4),
                Text(value,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
      ],
    );
  }

  Widget _prList(List<PersonalRecord> prs) {
    if (prs.isEmpty) {
      return const Text('No PRs yet — your first logged set on any exercise counts.',
          style: TextStyle(color: AppColors.inkMuted, fontSize: 13));
    }
    return Column(
      children: [
        for (final pr in prs)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              padding: const EdgeInsets.all(12),
              borderColor: _selectedExerciseId == pr.exerciseId ? AppColors.accent : AppColors.line,
              backgroundColor: _selectedExerciseId == pr.exerciseId ? AppColors.accent.withValues(alpha: 0.06) : null,
              onTap: () => _selectExercise(pr.exerciseId),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(pr.exerciseName, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text('PR achieved ${_fmtDate(pr.performedAt)}',
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
                      ],
                    ),
                  ),
                  Text('${pr.weightKg} kg × ${pr.reps}',
                      style: const TextStyle(color: AppColors.accent, fontSize: 15, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _progressionSection(List<PersonalRecord> prs) {
    if (prs.isEmpty) {
      return const Text('Log a few sessions on an exercise to see it progress here.',
          style: TextStyle(color: AppColors.inkMuted, fontSize: 13));
    }
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<String>(
            initialValue: _selectedExerciseId,
            decoration: const InputDecoration(isDense: true),
            items: [
              for (final pr in prs) DropdownMenuItem(value: pr.exerciseId, child: Text(pr.exerciseName)),
            ],
            onChanged: (v) {
              if (v != null) _selectExercise(v);
            },
          ),
          const SizedBox(height: 14),
          if (_progressionLoading)
            const SizedBox(height: 180, child: Center(child: CircularProgressIndicator()))
          else if (_progression != null) ...[
            if (_progression!.series.length > 1)
              SizedBox(height: 180, child: _progressionChart(_progression!.series))
            else
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text('Log this exercise again to start a trend line.',
                      style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
                ),
              ),
            const SizedBox(height: 14),
            _progressionStatsGrid(_progression!),
            const SizedBox(height: 14),
            _ProgressionSettings(exerciseId: _selectedExerciseId!, exerciseName: _progression!.exerciseName),
          ],
        ],
      ),
    );
  }

  Widget _progressionChart(List<ProgressionSessionPoint> series) {
    final spots = [
      for (var i = 0; i < series.length; i++) FlSpot(i.toDouble(), series[i].weightKg),
    ];
    final minY = series.map((p) => p.weightKg).reduce((a, b) => a < b ? a : b) - 2;
    final maxY = series.map((p) => p.weightKg).reduce((a, b) => a > b ? a : b) + 2;

    return LineChart(
      LineChartData(
        minY: minY,
        maxY: maxY,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (_) => FlLine(color: AppColors.line, strokeWidth: 1),
        ),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (v, meta) {
              return Text(v.round().toString(), style: const TextStyle(color: AppColors.inkMuted, fontSize: 10));
            }),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 24,
              interval: (series.length / 4).ceilToDouble().clamp(1, double.infinity),
              getTitlesWidget: (v, meta) {
                final i = v.round();
                if (i < 0 || i >= series.length) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(_fmtDate(series[i].date), style: const TextStyle(color: AppColors.inkMuted, fontSize: 9)),
                );
              },
            ),
          ),
        ),
        borderData: FlBorderData(show: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: AppColors.accent,
            barWidth: 2,
            dotData: const FlDotData(show: true),
            belowBarData: BarAreaData(show: true, color: AppColors.accent.withValues(alpha: 0.08)),
          ),
        ],
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => AppColors.surface,
            getTooltipItems: (spots) => spots.map((s) {
              final point = series[s.x.round()];
              return LineTooltipItem('${point.weightKg} kg', const TextStyle(color: AppColors.ink, fontSize: 11));
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _progressionStatsGrid(ExerciseProgressionStats p) {
    final stats = [
      ('Best weight', p.bestWeightKg != null ? '${p.bestWeightKg} kg' : '—'),
      ('Est. 1RM', p.bestEstimated1RmKg != null ? '${p.bestEstimated1RmKg} kg' : '—'),
      ('Total volume', '${p.totalVolumeKg.round()} kg'),
      ('Sessions', '${p.sessionCount}'),
      ('First performed', p.firstPerformedAt != null ? _fmtDate(p.firstPerformedAt!) : '—'),
      ('Last performed', p.lastPerformedAt != null ? _fmtDate(p.lastPerformedAt!) : '—'),
    ];
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 1.3,
      children: [
        for (final (label, value) in stats)
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.circular(8)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(label, style: const TextStyle(color: AppColors.inkMuted, fontSize: 9)),
                const SizedBox(height: 2),
                Text(value, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.ink, fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
      ],
    );
  }

  Widget _volumeSection(List<WeeklyVolume> weekly, List<MuscleVolume> muscle) {
    final muscleTotals = <String, double>{};
    for (final row in muscle) {
      muscleTotals[row.muscle] = (muscleTotals[row.muscle] ?? 0) + row.volumeKg;
    }
    final sortedMuscles = muscleTotals.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final topMuscles = sortedMuscles.take(8).toList();
    final maxMuscleVolume = topMuscles.isEmpty ? 1.0 : topMuscles.first.value;

    return Column(
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Weekly volume', style: TextStyle(color: AppColors.inkSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              if (weekly.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('Not enough data yet.', style: TextStyle(color: AppColors.inkMuted, fontSize: 12))),
                )
              else
                SizedBox(
                  height: 140,
                  child: BarChart(
                    BarChartData(
                      gridData: const FlGridData(show: false),
                      borderData: FlBorderData(show: false),
                      titlesData: const FlTitlesData(
                        topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      ),
                      barGroups: [
                        for (var i = 0; i < weekly.length; i++)
                          BarChartGroupData(x: i, barRods: [
                            BarChartRodData(toY: weekly[i].volumeKg, color: AppColors.accent, width: 12,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(3))),
                          ]),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Volume by muscle', style: TextStyle(color: AppColors.inkSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              if (topMuscles.isEmpty)
                const Text('Not enough data yet.', style: TextStyle(color: AppColors.inkMuted, fontSize: 12))
              else
                for (final entry in topMuscles)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(_humanize(entry.key), style: const TextStyle(color: AppColors.inkSecondary, fontSize: 12)),
                            Text('${entry.value.round()} kg', style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: entry.value / maxMuscleVolume,
                            minHeight: 5,
                            backgroundColor: AppColors.surfaceHover,
                            valueColor: const AlwaysStoppedAnimation(AppColors.accent),
                          ),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _historyList(List<WorkoutSummary> history) {
    if (history.isEmpty) {
      return const Text('No workouts logged yet.', style: TextStyle(color: AppColors.inkMuted, fontSize: 13));
    }
    return Column(
      children: [
        for (final w in history.take(20))
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(w.name, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: AppColors.ink, fontSize: 13, fontWeight: FontWeight.w600)),
                        Text(_fmtDate(w.performedAt), style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
                      ],
                    ),
                  ),
                  Text('${w.setCount} sets · ${w.totalVolumeKg.round()} kg',
                      style: const TextStyle(color: AppColors.inkSecondary, fontSize: 11)),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _emptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.fitness_center_rounded, color: AppColors.inkMuted, size: 32),
            SizedBox(height: 12),
            Text(
              'Log a workout to start seeing your analysis — PRs, progression, and volume all build from your real training data.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.inkSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _errorState(String message) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.wifi_off_rounded, color: AppColors.inkMuted, size: 32),
                  const SizedBox(height: 12),
                  Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.inkSecondary)),
                  const SizedBox(height: 16),
                  OutlinedButton(onPressed: _refresh, child: const Text('Retry')),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact per-exercise progression settings — override increment, or
/// disable progression entirely for this exercise. Uses the existing
/// `PATCH /exercises/progressions` endpoint, never a client-side
/// recalculation.
class _ProgressionSettings extends ConsumerStatefulWidget {
  final String exerciseId;
  final String exerciseName;

  const _ProgressionSettings({required this.exerciseId, required this.exerciseName});

  @override
  ConsumerState<_ProgressionSettings> createState() => _ProgressionSettingsState();
}

class _ProgressionSettingsState extends ConsumerState<_ProgressionSettings> {
  bool _expanded = false;
  bool _saving = false;
  final _incrementController = TextEditingController();

  @override
  void dispose() {
    _incrementController.dispose();
    super.dispose();
  }

  Future<void> _save({double? incrementKg, bool? enabled}) async {
    setState(() => _saving = true);
    try {
      await ref.read(progressionsApiProvider).updateProgression(
            exerciseId: widget.exerciseId,
            incrementKg: incrementKg,
            enabled: enabled,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Progression settings saved')));
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          child: Row(
            children: [
              const Icon(Icons.tune_rounded, size: 14, color: AppColors.inkMuted),
              const SizedBox(width: 6),
              const Text('Progression settings', style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
              const Spacer(),
              Icon(_expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded, size: 18, color: AppColors.inkMuted),
            ],
          ),
        ),
        if (_expanded) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _incrementController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(isDense: true, hintText: 'Custom increment (kg)'),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _saving
                    ? null
                    : () {
                        final v = double.tryParse(_incrementController.text);
                        if (v != null) _save(incrementKg: v);
                      },
                child: const Text('Save'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _saving ? null : () => _save(enabled: false),
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.inkSecondary),
              child: const Text('Disable progression for this exercise', style: TextStyle(fontSize: 12)),
            ),
          ),
        ],
      ],
    );
  }
}
