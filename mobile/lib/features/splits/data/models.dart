// Mirrors backend/app/schemas/split.py.

class SplitExercise {
  final String exerciseId;
  final String name;
  final String category;
  final String movementType;
  final int sets;
  final String reps;
  final String reason;

  const SplitExercise({
    required this.exerciseId,
    required this.name,
    required this.category,
    required this.movementType,
    required this.sets,
    required this.reps,
    required this.reason,
  });

  factory SplitExercise.fromJson(Map<String, dynamic> json) => SplitExercise(
        exerciseId: json['exercise_id'] as String,
        name: json['name'] as String,
        category: json['category'] as String,
        movementType: json['movement_type'] as String,
        sets: json['sets'] as int,
        reps: json['reps'] as String,
        reason: json['reason'] as String,
      );
}

class SplitDay {
  final int dayNumber;
  final String label;
  final List<SplitExercise> exercises;

  const SplitDay({required this.dayNumber, required this.label, required this.exercises});

  factory SplitDay.fromJson(Map<String, dynamic> json) => SplitDay(
        dayNumber: json['day_number'] as int,
        label: json['label'] as String,
        exercises:
            (json['exercises'] as List<dynamic>).map((e) => SplitExercise.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class SplitPlan {
  final String id;
  final String splitType;
  final int daysPerWeek;
  final String experienceLevel;
  final String goal;
  final List<SplitDay> days;
  final List<int> completedDayNumbers;
  final int nextDayNumber;

  const SplitPlan({
    required this.id,
    required this.splitType,
    required this.daysPerWeek,
    required this.experienceLevel,
    required this.goal,
    required this.days,
    required this.completedDayNumbers,
    required this.nextDayNumber,
  });

  SplitDay? get todayDay {
    for (final day in days) {
      if (day.dayNumber == nextDayNumber) return day;
    }
    return days.isEmpty ? null : days.first;
  }

  List<SplitDay> upcoming({int count = 2}) {
    if (days.isEmpty) return const [];
    final today = todayDay;
    final result = <SplitDay>[];
    for (var i = 1; i <= days.length && result.length < count; i++) {
      final dayNumber = ((nextDayNumber - 1 + i) % days.length) + 1;
      final day = days.where((d) => d.dayNumber == dayNumber).firstOrNull;
      if (day != null && day.dayNumber != today?.dayNumber) result.add(day);
    }
    return result;
  }

  factory SplitPlan.fromJson(Map<String, dynamic> json) => SplitPlan(
        id: json['id'] as String,
        splitType: json['split_type'] as String,
        daysPerWeek: json['days_per_week'] as int,
        experienceLevel: json['experience_level'] as String,
        goal: json['goal'] as String,
        days: (json['days'] as List<dynamic>).map((d) => SplitDay.fromJson(d as Map<String, dynamic>)).toList(),
        completedDayNumbers: (json['completed_day_numbers'] as List<dynamic>).cast<int>(),
        nextDayNumber: json['next_day_number'] as int,
      );
}

class SplitSummary {
  final String id;
  final String splitType;
  final int daysPerWeek;
  final String goal;
  final bool isActive;
  final DateTime createdAt;

  const SplitSummary({
    required this.id,
    required this.splitType,
    required this.daysPerWeek,
    required this.goal,
    required this.isActive,
    required this.createdAt,
  });

  factory SplitSummary.fromJson(Map<String, dynamic> json) => SplitSummary(
        id: json['id'] as String,
        splitType: json['split_type'] as String,
        daysPerWeek: json['days_per_week'] as int,
        goal: json['goal'] as String,
        isActive: json['is_active'] as bool,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}
