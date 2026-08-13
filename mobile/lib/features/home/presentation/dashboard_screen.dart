import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../auth/state/auth_controller.dart';
import '../../navigation/presentation/main_shell.dart';
import '../../weight/presentation/weight_screen.dart';
import '../data/dashboard_api.dart';
import '../data/models.dart';

final dashboardApiProvider = Provider((ref) => DashboardApi(ref.watch(dioProvider)));

String _formatDate(DateTime d) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${months[d.month - 1]} ${d.day}';
}

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  late Future<DashboardData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<DashboardData> _load() => ref.read(dashboardApiProvider).fetchDashboard();

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _future = next);
    await next;
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: AppColors.accent,
          backgroundColor: AppColors.surface,
          child: FutureBuilder<DashboardData>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return _DashboardSkeleton(name: user?.fullName ?? '');
              }
              if (snapshot.hasError) {
                return _DashboardError(
                  message: snapshot.error is ApiException
                      ? (snapshot.error as ApiException).message
                      : 'Something went wrong loading your dashboard.',
                  onRetry: _refresh,
                );
              }
              final data = snapshot.data!;
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  Text(
                    'Welcome, ${user?.fullName ?? ''}',
                    style: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _QuickStartCard(data: data),
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: _StreakCard(streaks: data.streaks)),
                      const SizedBox(width: 12),
                      Expanded(child: _AdherenceCard(streaks: data.streaks)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _WeightCard(weight: data.weight),
                  const SizedBox(height: 12),
                  _RecentPrCard(pr: data.recentPr),
                  const SizedBox(height: 12),
                  _QuickActionsRow(),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _QuickStartCard extends ConsumerWidget {
  final DashboardData data;

  const _QuickStartCard({required this.data});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final split = data.activeSplit;
    final today = split?.todayDay;
    final upcoming = split?.upcoming() ?? const [];
    final lastWorkout = data.lastWorkout;

    return AppCard(
      borderColor: AppColors.accent.withValues(alpha: 0.4),
      backgroundColor: AppColors.accent.withValues(alpha: 0.08),
      onTap: () => ref.read(selectedTabProvider.notifier).state = 1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (split != null && today != null) ...[
            Text('Active split · ${split.splitType}',
                style: const TextStyle(color: AppColors.accent, fontSize: 12)),
            const SizedBox(height: 4),
            Text('Today: ${today.label}',
                style: const TextStyle(color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w600)),
            if (upcoming.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('Up next: ${upcoming.map((d) => d.label).join(', ')}',
                  style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
            ],
          ] else ...[
            const Text('Ready to train?',
                style: TextStyle(color: AppColors.accent, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              lastWorkout != null
                  ? 'Last: ${lastWorkout.name} · ${_formatDate(lastWorkout.performedAt)} · ${lastWorkout.setCount} sets'
                  : 'Log your first workout to get started.',
              style: const TextStyle(color: AppColors.inkSecondary, fontSize: 14),
            ),
          ],
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(8)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(today != null ? Icons.play_arrow_rounded : Icons.fitness_center_rounded,
                      color: Colors.white, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    today != null ? 'Start ${today.label}' : 'Start Workout',
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StreakCard extends StatelessWidget {
  final Streaks? streaks;

  const _StreakCard({required this.streaks});

  @override
  Widget build(BuildContext context) {
    final days = streaks?.loggingStreakDays ?? 0;
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.local_fire_department_rounded, color: AppColors.inkMuted, size: 15),
              SizedBox(width: 6),
              Text('Streak', style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 6),
          Text('$days ${days == 1 ? 'day' : 'days'}',
              style: const TextStyle(color: AppColors.ink, fontSize: 20, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _AdherenceCard extends StatelessWidget {
  final Streaks? streaks;

  const _AdherenceCard({required this.streaks});

  @override
  Widget build(BuildContext context) {
    final adherence = streaks?.weeklyAdherence;
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.event_available_rounded, color: AppColors.inkMuted, size: 15),
              SizedBox(width: 6),
              Text('This week', style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 6),
          adherence != null
              ? Text('${adherence.completed}/${adherence.planned}',
                  style: const TextStyle(color: AppColors.ink, fontSize: 20, fontWeight: FontWeight.w600))
              : const Text('No split yet',
                  style: TextStyle(color: AppColors.inkSecondary, fontSize: 13)),
        ],
      ),
    );
  }
}

class _WeightCard extends ConsumerWidget {
  final WeightSummary? weight;

  const _WeightCard({required this.weight});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = weight?.currentWeightKg;
    final rate = weight?.rateKgPerWeek;
    final rateColor = rate == null
        ? AppColors.inkMuted
        : rate < 0
            ? const Color(0xFF34D399)
            : const Color(0xFFFBBF24);

    return AppCard(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WeightScreen())),
      child: current == null
          ? const Row(
              children: [
                Icon(Icons.monitor_weight_outlined, color: AppColors.inkMuted, size: 22),
                SizedBox(width: 10),
                Expanded(
                  child: Text('No weight logged yet.', style: TextStyle(color: AppColors.inkSecondary, fontSize: 14)),
                ),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Current weight', style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text('${current.toStringAsFixed(1)} kg',
                        style: const TextStyle(color: AppColors.ink, fontSize: 20, fontWeight: FontWeight.w600)),
                    if (rate != null) ...[
                      const SizedBox(width: 10),
                      Text(
                        '${rate > 0 ? '+' : ''}${rate.toStringAsFixed(2)} kg/wk',
                        style: TextStyle(color: rateColor, fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ],
                ),
              ],
            ),
    );
  }
}

class _RecentPrCard extends StatelessWidget {
  final PersonalRecord? pr;

  const _RecentPrCard({required this.pr});

  @override
  Widget build(BuildContext context) {
    if (pr == null) return const SizedBox.shrink();
    return AppCard(
      child: Row(
        children: [
          const Icon(Icons.emoji_events_rounded, color: AppColors.accent, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Recent PR', style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
                const SizedBox(height: 2),
                Text(
                  '${pr!.exerciseName} · ${pr!.weightKg.toStringAsFixed(1)} kg × ${pr!.reps}',
                  style: const TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600),
                ),
                Text('Achieved ${_formatDate(pr!.performedAt)}',
                    style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionsRow extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Widget action(IconData icon, String label, VoidCallback onTap) {
      return Expanded(
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              children: [
                Icon(icon, color: AppColors.inkSecondary, size: 20),
                const SizedBox(height: 6),
                Text(label, style: const TextStyle(color: AppColors.inkSecondary, fontSize: 12)),
              ],
            ),
          ),
        ),
      );
    }

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          action(Icons.monitor_weight_outlined, 'Log Weight',
              () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WeightScreen()))),
          action(Icons.forum_outlined, 'Ask Coach', () => ref.read(selectedTabProvider.notifier).state = 2),
          action(Icons.trending_up_rounded, 'Progress', () => ref.read(selectedTabProvider.notifier).state = 3),
        ],
      ),
    );
  }
}

class _DashboardSkeleton extends StatelessWidget {
  final String name;

  const _DashboardSkeleton({required this.name});

  @override
  Widget build(BuildContext context) {
    Widget box(double height) => Container(
          height: height,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12)),
        );

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      physics: const NeverScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 8),
        box(28),
        const SizedBox(height: 8),
        box(120),
        Row(children: [Expanded(child: box(80)), const SizedBox(width: 12), Expanded(child: box(80))]),
        box(70),
        box(80),
      ],
    );
  }
}

class _DashboardError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _DashboardError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
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
                  OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
