import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../coach/presentation/coach_screen.dart';
import '../../home/presentation/dashboard_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../progress/presentation/progress_screen.dart';
import '../../workouts/presentation/workouts_tab_screen.dart';

/// Which bottom-nav tab is selected — a plain index rather than a router,
/// so any screen can jump to another tab (e.g. the dashboard's "Start
/// Workout" card switching to the Workouts tab) via
/// `ref.read(selectedTabProvider.notifier).state = 1`.
final selectedTabProvider = StateProvider<int>((ref) => 0);

class MainShell extends ConsumerWidget {
  const MainShell({super.key});

  static const _tabs = [
    (icon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.fitness_center_rounded, label: 'Workouts'),
    (icon: Icons.forum_rounded, label: 'Coach'),
    (icon: Icons.trending_up_rounded, label: 'Progress'),
    (icon: Icons.person_rounded, label: 'Profile'),
  ];

  static final _screens = [
    const DashboardScreen(),
    const WorkoutsTabScreen(),
    const CoachScreen(),
    const ProgressScreen(),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(selectedTabProvider);

    return Scaffold(
      body: IndexedStack(index: selected, children: _screens),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        child: SafeArea(
          child: SizedBox(
            height: 60,
            child: Row(
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  Expanded(
                    child: _TabButton(
                      icon: _tabs[i].icon,
                      label: _tabs[i].label,
                      selected: selected == i,
                      onTap: () => ref.read(selectedTabProvider.notifier).state = i,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _TabButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.accent : AppColors.inkMuted;
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
