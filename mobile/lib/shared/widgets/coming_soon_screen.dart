import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Placeholder for a nav tab whose real screen lands in a later build
/// phase — deliberately branded (not a blank white screen) so the app
/// still feels finished while functionality is still being built out.
class ComingSoonScreen extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  const ComingSoonScreen({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.accent.withValues(alpha: 0.4)),
                  ),
                  child: Icon(icon, color: AppColors.accent, size: 28),
                ),
                const SizedBox(height: 20),
                Text(
                  title,
                  style: const TextStyle(color: AppColors.ink, fontSize: 20, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.inkSecondary, fontSize: 14),
                ),
                if (action != null) ...[
                  const SizedBox(height: 20),
                  action!,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
