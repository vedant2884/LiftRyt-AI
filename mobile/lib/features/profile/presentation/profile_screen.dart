import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../auth/state/auth_controller.dart';
import '../../library/presentation/library_screen.dart';
import '../../macros/presentation/macros_screen.dart';
import '../../splits/presentation/splits_screen.dart';
import '../../weight/presentation/weight_screen.dart';

/// Profile / Settings hub — mirrors what `frontend/src/pages/ProfilePage.tsx`
/// exposes (default progression increment, preferred split, logout) plus
/// serves as the mobile "more" entry point for Weight/Macros/Library, which
/// don't have their own bottom-nav tab.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _incrementController = TextEditingController();
  bool _savingIncrement = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final user = ref.read(authControllerProvider).user;
    if (user != null && _incrementController.text.isEmpty) {
      _incrementController.text = user.defaultProgressionIncrementKg.toString();
    }
  }

  @override
  void dispose() {
    _incrementController.dispose();
    super.dispose();
  }

  Future<void> _saveIncrement() async {
    final value = double.tryParse(_incrementController.text);
    if (value == null || value <= 0) return;
    setState(() => _savingIncrement = true);
    try {
      await ref.read(authControllerProvider.notifier).updateProfile(defaultProgressionIncrementKg: value);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Default increment updated')));
      }
    } finally {
      if (mounted) setState(() => _savingIncrement = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
          children: [
            const Text('Profile', style: TextStyle(color: AppColors.ink, fontSize: 24, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            AppCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.accent.withValues(alpha: 0.15),
                    child: Text(
                      (user?.fullName.isNotEmpty ?? false) ? user!.fullName[0].toUpperCase() : '?',
                      style: const TextStyle(color: AppColors.accent, fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user?.fullName ?? '',
                            style: const TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(user?.email ?? '', style: const TextStyle(color: AppColors.inkMuted, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Text('More', style: TextStyle(color: AppColors.inkMuted, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _navRow(Icons.monitor_weight_outlined, 'Weight', () => _push(const WeightScreen())),
                  const Divider(color: AppColors.line, height: 1),
                  _navRow(Icons.pie_chart_outline_rounded, 'Macros', () => _push(const MacrosScreen())),
                  const Divider(color: AppColors.line, height: 1),
                  _navRow(Icons.menu_book_outlined, 'Exercise Library', () => _push(const LibraryScreen())),
                  const Divider(color: AppColors.line, height: 1),
                  _navRow(Icons.calendar_month_outlined, 'Workout Splits', () => _push(const SplitsScreen())),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Text('Progression', style: TextStyle(color: AppColors.inkMuted, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Default weight increment', style: TextStyle(color: AppColors.ink, fontSize: 13)),
                  const SizedBox(height: 4),
                  const Text('Used for every exercise unless it has its own override (set from Progress).',
                      style: TextStyle(color: AppColors.inkMuted, fontSize: 11)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _incrementController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(isDense: true, suffixText: 'kg'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _savingIncrement ? null : _saveIncrement,
                        child: Text(_savingIncrement ? 'Saving...' : 'Save'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => ref.read(authControllerProvider.notifier).logout(),
                icon: const Icon(Icons.logout_rounded, size: 18),
                label: const Text('Log out'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFF87171),
                  side: const BorderSide(color: Color(0xFFF87171)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _push(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  Widget _navRow(IconData icon, String label, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: AppColors.inkSecondary, size: 20),
      title: Text(label, style: const TextStyle(color: AppColors.ink, fontSize: 14)),
      trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.inkMuted, size: 20),
      onTap: onTap,
    );
  }
}
