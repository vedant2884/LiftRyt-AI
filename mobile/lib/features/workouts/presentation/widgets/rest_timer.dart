import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../state/active_workout_state.dart';

const _presets = [60, 90, 120];

String _formatTime(int totalSeconds) {
  final m = totalSeconds ~/ 60;
  final s = totalSeconds % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}

/// Rest timer — accessible without leaving the active workout screen.
/// `restEndsAt` is an absolute timestamp (not a running countdown value),
/// so it survives an app kill correctly: remaining time is always just
/// `endsAt - now`, recomputed from the persisted state on next launch.
class RestTimer extends ConsumerStatefulWidget {
  const RestTimer({super.key});

  @override
  ConsumerState<RestTimer> createState() => _RestTimerState();
}

class _RestTimerState extends ConsumerState<RestTimer> {
  Timer? _ticker;
  DateTime _now = DateTime.now();
  bool _notified = false;

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _ensureTicking(bool shouldTick) {
    if (shouldTick && _ticker == null) {
      _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) {
        if (mounted) setState(() => _now = DateTime.now());
      });
    } else if (!shouldTick && _ticker != null) {
      _ticker!.cancel();
      _ticker = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final workout = ref.watch(activeWorkoutProvider);
    final controller = ref.read(activeWorkoutProvider.notifier);
    final restEndsAt = workout.restEndsAt;

    _ensureTicking(restEndsAt != null);

    final remaining = restEndsAt != null
        ? (restEndsAt.difference(_now).inMilliseconds / 1000).round().clamp(0, 1 << 30)
        : workout.restDurationSeconds;

    if (restEndsAt != null && remaining == 0 && !_notified) {
      _notified = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => controller.stopRestTimer());
    } else if (restEndsAt == null && _notified) {
      _notified = false;
    }

    if (restEndsAt == null) {
      return Row(
        children: [
          const Icon(Icons.timer_outlined, color: AppColors.inkMuted, size: 16),
          const SizedBox(width: 6),
          const Text('Rest', style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
          const SizedBox(width: 10),
          for (final seconds in _presets) ...[
            _PresetChip(seconds: seconds, onTap: () => controller.startRestTimer(seconds)),
            const SizedBox(width: 6),
          ],
        ],
      );
    }

    return Row(
      children: [
        const Icon(Icons.timer_rounded, color: AppColors.accent, size: 16),
        const SizedBox(width: 6),
        Text(
          _formatTime(remaining),
          style: const TextStyle(color: AppColors.accent, fontSize: 15, fontWeight: FontWeight.w600),
        ),
        const Spacer(),
        IconButton(
          onPressed: controller.stopRestTimer,
          icon: const Icon(Icons.pause_rounded, size: 18),
          color: AppColors.inkMuted,
          tooltip: 'Stop rest timer',
        ),
        IconButton(
          onPressed: () => controller.startRestTimer(workout.restDurationSeconds),
          icon: const Icon(Icons.replay_rounded, size: 18),
          color: AppColors.inkMuted,
          tooltip: 'Reset rest timer',
        ),
      ],
    );
  }
}

class _PresetChip extends StatelessWidget {
  final int seconds;
  final VoidCallback onTap;

  const _PresetChip({required this.seconds, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.lineStrong),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text('${seconds}s', style: const TextStyle(color: AppColors.ink, fontSize: 12)),
      ),
    );
  }
}
