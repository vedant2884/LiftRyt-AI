import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../data/models.dart';
import '../data/weight_api.dart';

String _fmtDate(DateTime d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${months[d.month - 1]} ${d.day}';
}

/// Mirrors `frontend/src/pages/WeightPage.tsx` — same backend analytics
/// (trend/moving averages computed server-side, never recalculated here).
class WeightScreen extends ConsumerStatefulWidget {
  const WeightScreen({super.key});

  @override
  ConsumerState<WeightScreen> createState() => _WeightScreenState();
}

class _WeightScreenState extends ConsumerState<WeightScreen> {
  WeightAnalytics? _analytics;
  List<WeightLog> _logs = [];
  bool _loading = true;
  final _weightController = TextEditingController();
  bool _logging = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _weightController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(weightApiProvider);
      final analytics = await api.fetchAnalytics();
      final logs = await api.listLogs();
      if (mounted) {
        setState(() {
          _analytics = analytics;
          _logs = logs;
          _loading = false;
        });
      }
    } on ApiException {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logWeight() async {
    final value = double.tryParse(_weightController.text);
    if (value == null || value <= 0) return;
    setState(() => _logging = true);
    try {
      await ref.read(weightApiProvider).logWeight(weightKg: value);
      _weightController.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _logging = false);
    }
  }

  Future<void> _deleteLog(String id) async {
    try {
      await ref.read(weightApiProvider).deleteLog(id);
      _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Weight')),
      body: SafeArea(child: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.accent,
              backgroundColor: AppColors.surface,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _currentWeightCard(),
                  const SizedBox(height: 12),
                  _logForm(),
                  if ((_analytics?.series.length ?? 0) > 1) ...[
                    const SizedBox(height: 12),
                    _chartCard(_analytics!.series),
                  ],
                  const SizedBox(height: 20),
                  const Text('History', style: TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 10),
                  if (_logs.isEmpty)
                    const Text('No weight logged yet.', style: TextStyle(color: AppColors.inkMuted, fontSize: 13))
                  else
                    for (final log in _logs)
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
                                    Text('${log.weightKg} kg',
                                        style: const TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
                                    Text(_fmtDate(log.loggedAt), style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
                                  ],
                                ),
                              ),
                              IconButton(
                                onPressed: () => _deleteLog(log.id),
                                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                                color: AppColors.inkMuted,
                              ),
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

  Widget _currentWeightCard() {
    final current = _analytics?.currentWeightKg;
    final rate = _analytics?.trend.rateKgPerWeek;
    return AppCard(
      child: current == null
          ? const Text('No weight logged yet.', style: TextStyle(color: AppColors.inkSecondary, fontSize: 14))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Current weight', style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text('$current kg', style: const TextStyle(color: AppColors.ink, fontSize: 24, fontWeight: FontWeight.w600)),
                    if (rate != null) ...[
                      const SizedBox(width: 10),
                      Text('${rate > 0 ? '+' : ''}${rate.toStringAsFixed(2)} kg/wk',
                          style: TextStyle(
                              color: rate < 0 ? const Color(0xFF34D399) : const Color(0xFFFBBF24),
                              fontSize: 13,
                              fontWeight: FontWeight.w500)),
                    ],
                  ],
                ),
              ],
            ),
    );
  }

  Widget _logForm() {
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _weightController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(isDense: true, hintText: 'Weight (kg)'),
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: _logging ? null : _logWeight,
            child: Text(_logging ? 'Logging...' : 'Log'),
          ),
        ],
      ),
    );
  }

  Widget _chartCard(List<WeightSeriesPoint> series) {
    final spots = [for (var i = 0; i < series.length; i++) FlSpot(i.toDouble(), series[i].weightKg)];
    return AppCard(
      child: SizedBox(
        height: 180,
        child: LineChart(
          LineChartData(
            gridData: FlGridData(
                show: true, drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: AppColors.line, strokeWidth: 1)),
            titlesData: FlTitlesData(
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 36,
                    getTitlesWidget: (v, meta) =>
                        Text(v.round().toString(), style: const TextStyle(color: AppColors.inkMuted, fontSize: 10))),
              ),
              bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            ),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              LineChartBarData(
                spots: spots,
                isCurved: true,
                color: AppColors.accent,
                barWidth: 2,
                dotData: const FlDotData(show: false),
                belowBarData: BarAreaData(show: true, color: AppColors.accent.withValues(alpha: 0.08)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
