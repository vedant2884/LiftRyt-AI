// Mirrors backend/app/schemas/workout.py, exercise.py, progression.py.

class WorkoutSet {
  final String id;
  final String? exerciseId;
  final String? customExerciseId;
  final bool isCustom;
  final String exerciseName;
  final int setNumber;
  final int reps;
  final double weightKg;
  final bool isWarmup;
  final bool isPr;
  final double? suggestedIncrementKg;

  const WorkoutSet({
    required this.id,
    this.exerciseId,
    this.customExerciseId,
    required this.isCustom,
    required this.exerciseName,
    required this.setNumber,
    required this.reps,
    required this.weightKg,
    required this.isWarmup,
    required this.isPr,
    this.suggestedIncrementKg,
  });

  factory WorkoutSet.fromJson(Map<String, dynamic> json) => WorkoutSet(
        id: json['id'] as String,
        exerciseId: json['exercise_id'] as String?,
        customExerciseId: json['custom_exercise_id'] as String?,
        isCustom: json['is_custom'] as bool,
        exerciseName: json['exercise_name'] as String,
        setNumber: json['set_number'] as int,
        reps: json['reps'] as int,
        weightKg: (json['weight_kg'] as num).toDouble(),
        isWarmup: json['is_warmup'] as bool,
        isPr: json['is_pr'] as bool? ?? false,
        suggestedIncrementKg: (json['suggested_increment_kg'] as num?)?.toDouble(),
      );
}

class WorkoutSummary {
  final String id;
  final String name;
  final DateTime performedAt;
  final int? durationSeconds;
  final int setCount;
  final double totalVolumeKg;

  const WorkoutSummary({
    required this.id,
    required this.name,
    required this.performedAt,
    this.durationSeconds,
    required this.setCount,
    required this.totalVolumeKg,
  });

  factory WorkoutSummary.fromJson(Map<String, dynamic> json) => WorkoutSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        performedAt: DateTime.parse(json['performed_at'] as String),
        durationSeconds: json['duration_seconds'] as int?,
        setCount: json['set_count'] as int,
        totalVolumeKg: (json['total_volume_kg'] as num).toDouble(),
      );
}

class WorkoutDetail {
  final String id;
  final String name;
  final DateTime performedAt;
  final int? durationSeconds;
  final List<WorkoutSet> sets;

  const WorkoutDetail({
    required this.id,
    required this.name,
    required this.performedAt,
    this.durationSeconds,
    required this.sets,
  });

  factory WorkoutDetail.fromJson(Map<String, dynamic> json) => WorkoutDetail(
        id: json['id'] as String,
        name: json['name'] as String,
        performedAt: DateTime.parse(json['performed_at'] as String),
        durationSeconds: json['duration_seconds'] as int?,
        sets: (json['sets'] as List<dynamic>)
            .map((s) => WorkoutSet.fromJson(s as Map<String, dynamic>))
            .toList(),
      );
}

class RecentExercise {
  final String id;
  final bool isCustom;
  final String name;
  final List<String> primaryMuscles;
  final String equipment;

  const RecentExercise({
    required this.id,
    required this.isCustom,
    required this.name,
    required this.primaryMuscles,
    required this.equipment,
  });

  factory RecentExercise.fromJson(Map<String, dynamic> json) => RecentExercise(
        id: json['id'] as String,
        isCustom: json['is_custom'] as bool,
        name: json['name'] as String,
        primaryMuscles: (json['primary_muscles'] as List<dynamic>).cast<String>(),
        equipment: json['equipment'] as String,
      );
}

/// A single item in the exercise picker, regardless of whether it came from
/// `/exercises`, `/exercises/custom`, `/exercises/favorites`, or
/// `/workouts/recent-exercises` — those four endpoints return differently
/// shaped rows, normalized here so the picker UI only deals with one shape.
class PickerExercise {
  final String id;
  final bool isCustom;
  final String name;
  final List<String> primaryMuscles;
  final String equipment;

  const PickerExercise({
    required this.id,
    required this.isCustom,
    required this.name,
    required this.primaryMuscles,
    required this.equipment,
  });
}

class ExerciseProgression {
  final String exerciseId;
  final String exerciseName;
  final double incrementKg;
  final double? incrementKgOverride;
  final double? nextSuggestedWeightKg;
  final bool enabled;

  const ExerciseProgression({
    required this.exerciseId,
    required this.exerciseName,
    required this.incrementKg,
    this.incrementKgOverride,
    this.nextSuggestedWeightKg,
    required this.enabled,
  });

  factory ExerciseProgression.fromJson(Map<String, dynamic> json) => ExerciseProgression(
        exerciseId: json['exercise_id'] as String,
        exerciseName: json['exercise_name'] as String,
        incrementKg: (json['increment_kg'] as num).toDouble(),
        incrementKgOverride: (json['increment_kg_override'] as num?)?.toDouble(),
        nextSuggestedWeightKg: (json['next_suggested_weight_kg'] as num?)?.toDouble(),
        enabled: json['enabled'] as bool,
      );
}
