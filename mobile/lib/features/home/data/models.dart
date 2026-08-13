// Mirrors backend/app/schemas/streaks.py, weight.py (the fields the
// dashboard needs), workouts.py's WorkoutSummary/PersonalRecord, and
// splits.py's SplitPlanOut/SplitDay — lean subsets, not full re-declarations
// of every field those schemas have, since the dashboard only ever displays
// a handful of values from each.

class WeeklyAdherence {
  final int completed;
  final int planned;

  const WeeklyAdherence({required this.completed, required this.planned});

  factory WeeklyAdherence.fromJson(Map<String, dynamic> json) => WeeklyAdherence(
        completed: json['completed'] as int,
        planned: json['planned'] as int,
      );
}

class Streaks {
  final int loggingStreakDays;
  final WeeklyAdherence? weeklyAdherence;

  const Streaks({required this.loggingStreakDays, this.weeklyAdherence});

  factory Streaks.fromJson(Map<String, dynamic> json) => Streaks(
        loggingStreakDays: json['logging_streak_days'] as int,
        weeklyAdherence: json['weekly_adherence'] == null
            ? null
            : WeeklyAdherence.fromJson(json['weekly_adherence'] as Map<String, dynamic>),
      );
}

class WeightSummary {
  final double? currentWeightKg;
  final double? rateKgPerWeek;

  const WeightSummary({this.currentWeightKg, this.rateKgPerWeek});

  factory WeightSummary.fromJson(Map<String, dynamic> json) => WeightSummary(
        currentWeightKg: (json['current_weight_kg'] as num?)?.toDouble(),
        rateKgPerWeek: (json['trend'] as Map<String, dynamic>?)?['rate_kg_per_week'] == null
            ? null
            : ((json['trend'] as Map<String, dynamic>)['rate_kg_per_week'] as num).toDouble(),
      );
}

class WorkoutSummary {
  final String id;
  final String name;
  final DateTime performedAt;
  final int setCount;
  final double totalVolumeKg;

  const WorkoutSummary({
    required this.id,
    required this.name,
    required this.performedAt,
    required this.setCount,
    required this.totalVolumeKg,
  });

  factory WorkoutSummary.fromJson(Map<String, dynamic> json) => WorkoutSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        performedAt: DateTime.parse(json['performed_at'] as String),
        setCount: json['set_count'] as int,
        totalVolumeKg: (json['total_volume_kg'] as num).toDouble(),
      );
}

class PersonalRecord {
  final String exerciseId;
  final String exerciseName;
  final double weightKg;
  final int reps;
  final DateTime performedAt;

  const PersonalRecord({
    required this.exerciseId,
    required this.exerciseName,
    required this.weightKg,
    required this.reps,
    required this.performedAt,
  });

  factory PersonalRecord.fromJson(Map<String, dynamic> json) => PersonalRecord(
        exerciseId: json['exercise_id'] as String,
        exerciseName: json['exercise_name'] as String,
        weightKg: (json['weight_kg'] as num).toDouble(),
        reps: json['reps'] as int,
        performedAt: DateTime.parse(json['performed_at'] as String),
      );
}

class SplitDaySummary {
  final int dayNumber;
  final String label;

  const SplitDaySummary({required this.dayNumber, required this.label});

  factory SplitDaySummary.fromJson(Map<String, dynamic> json) => SplitDaySummary(
        dayNumber: json['day_number'] as int,
        label: json['label'] as String,
      );
}

class ActiveSplit {
  final String id;
  final String splitType;
  final int daysPerWeek;
  final int nextDayNumber;
  final List<SplitDaySummary> days;

  const ActiveSplit({
    required this.id,
    required this.splitType,
    required this.daysPerWeek,
    required this.nextDayNumber,
    required this.days,
  });

  SplitDaySummary? get todayDay {
    for (final day in days) {
      if (day.dayNumber == nextDayNumber) return day;
    }
    return days.isEmpty ? null : days.first;
  }

  List<SplitDaySummary> upcoming({int count = 2}) {
    if (days.isEmpty) return const [];
    final today = todayDay;
    final result = <SplitDaySummary>[];
    for (var i = 1; i <= days.length && result.length < count; i++) {
      final dayNumber = ((nextDayNumber - 1 + i) % days.length) + 1;
      final day = days.firstWhere((d) => d.dayNumber == dayNumber, orElse: () => days.first);
      if (day.dayNumber != today?.dayNumber) result.add(day);
    }
    return result;
  }

  factory ActiveSplit.fromJson(Map<String, dynamic> json) => ActiveSplit(
        id: json['id'] as String,
        splitType: json['split_type'] as String,
        daysPerWeek: json['days_per_week'] as int,
        nextDayNumber: json['next_day_number'] as int,
        days: (json['days'] as List<dynamic>)
            .map((d) => SplitDaySummary.fromJson(d as Map<String, dynamic>))
            .toList(),
      );
}

class DashboardData {
  final Streaks? streaks;
  final WeightSummary? weight;
  final WorkoutSummary? lastWorkout;
  final PersonalRecord? recentPr;
  final ActiveSplit? activeSplit;

  const DashboardData({
    this.streaks,
    this.weight,
    this.lastWorkout,
    this.recentPr,
    this.activeSplit,
  });
}
