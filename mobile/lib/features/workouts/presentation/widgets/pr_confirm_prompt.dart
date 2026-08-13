import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// Shown inline right on the set that just PR'd — never a blocking modal,
/// and never applies anything on its own. A PR only ever offers to suggest
/// a next weight; the user has to explicitly confirm or dismiss it every
/// single time, per exercise. Mirrors
/// `frontend/src/components/workout/PrConfirmPrompt.tsx` exactly.
class PrConfirmPrompt extends StatelessWidget {
  final double prWeightKg;
  final double incrementKg;
  final VoidCallback onConfirm;
  final VoidCallback onDismiss;

  const PrConfirmPrompt({
    super.key,
    required this.prWeightKg,
    required this.incrementKg,
    required this.onConfirm,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final nextWeight = prWeightKg + incrementKg;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.emoji_events_rounded, color: Color(0xFFFBBF24), size: 15),
              SizedBox(width: 6),
              Text(
                'New PR! Increase next weight?',
                style: TextStyle(color: Color(0xFFFBBF24), fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 6),
          RichText(
            text: TextSpan(
              style: const TextStyle(color: AppColors.inkMuted, fontSize: 12),
              children: [
                TextSpan(text: '${_fmt(prWeightKg)} kg + ${_fmt(incrementKg)} kg → next suggested '),
                TextSpan(
                  text: '${_fmt(nextWeight)} kg',
                  style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              ElevatedButton(
                onPressed: onConfirm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text('+${_fmt(incrementKg)} kg', style: const TextStyle(fontSize: 12)),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: onDismiss,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.inkSecondary,
                  side: const BorderSide(color: AppColors.lineStrong),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Not now', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _fmt(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();
}
