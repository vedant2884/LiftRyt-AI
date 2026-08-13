import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

String _formatDuration(int totalSeconds) {
  final h = totalSeconds ~/ 3600;
  final m = (totalSeconds % 3600) ~/ 60;
  if (h > 0) return '${h}h ${m}m';
  return '$m min';
}

String _formatVolume(double kg) {
  if (kg >= 1000) return '${(kg / 1000).toStringAsFixed(1)}k kg';
  return '${kg.round()} kg';
}

/// Sticky live summary pinned above the bottom nav — sets, volume, and
/// duration update as the workout changes.
class WorkoutSummaryBar extends StatefulWidget {
  final DateTime startedAt;
  final int totalSets;
  final double totalVolumeKg;
  final VoidCallback onFinish;
  final bool finishing;

  const WorkoutSummaryBar({
    super.key,
    required this.startedAt,
    required this.totalSets,
    required this.totalVolumeKg,
    required this.onFinish,
    required this.finishing,
  });

  @override
  State<WorkoutSummaryBar> createState() => _WorkoutSummaryBarState();
}

class _WorkoutSummaryBarState extends State<WorkoutSummaryBar> {
  late final Timer _ticker;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _ticker.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final elapsed = _now.difference(widget.startedAt).inSeconds.clamp(0, 1 << 30);

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              _stat('${widget.totalSets}', widget.totalSets == 1 ? 'set' : 'sets'),
              const SizedBox(width: 16),
              _stat(_formatVolume(widget.totalVolumeKg), null),
              const SizedBox(width: 16),
              _stat(_formatDuration(elapsed), null),
              const Spacer(),
              ElevatedButton(
                onPressed: widget.finishing ? null : widget.onFinish,
                child: widget.finishing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Finish'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stat(String value, String? suffix) {
    return RichText(
      text: TextSpan(
        children: [
          TextSpan(
            text: value,
            style: const TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600),
          ),
          if (suffix != null)
            TextSpan(text: ' $suffix', style: const TextStyle(color: AppColors.inkMuted, fontSize: 13)),
        ],
      ),
    );
  }
}
