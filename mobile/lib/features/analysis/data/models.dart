// Mirrors backend/app/schemas/workout.py's analysis-facing shapes exactly
// (WorkoutOverview, PersonalRecord, WeeklyVolume, MuscleVolume,
// ExerciseProgressionStats, ProgressionSessionPoint) — same fields the web
// Analysis page (`frontend/src/pages/WorkoutAnalysisPage.tsx`) consumes.

class WorkoutOverview {
  final int totalWorkouts;
  final int workoutsThisWeek;
  final int workoutsThisMonth;
  final double totalVolumeKg;
  final int totalSets;
  final String? mostTrainedMuscle;
  final String? mostTrainedExerciseName;

  const WorkoutOverview({
    required this.totalWorkouts,
    required this.workoutsThisWeek,
    required this.workoutsThisMonth,
    required this.totalVolumeKg,
    required this.totalSets,
    this.mostTrainedMuscle,
    this.mostTrainedExerciseName,
  });

  factory WorkoutOverview.fromJson(Map<String, dynamic> json) => WorkoutOverview(
        totalWorkouts: json['total_workouts'] as int,
        workoutsThisWeek: json['workouts_this_week'] as int,
        workoutsThisMonth: json['workouts_this_month'] as int,
        totalVolumeKg: (json['total_volume_kg'] as num).toDouble(),
        totalSets: json['total_sets'] as int,
        mostTrainedMuscle: json['most_trained_muscle'] as String?,
        mostTrainedExerciseName: json['most_trained_exercise_name'] as String?,
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

class WeeklyVolume {
  final DateTime weekStart;
  final double volumeKg;
  final int workoutCount;

  const WeeklyVolume({required this.weekStart, required this.volumeKg, required this.workoutCount});

  factory WeeklyVolume.fromJson(Map<String, dynamic> json) => WeeklyVolume(
        weekStart: DateTime.parse(json['week_start'] as String),
        volumeKg: (json['volume_kg'] as num).toDouble(),
        workoutCount: json['workout_count'] as int,
      );
}

class MuscleVolume {
  final DateTime weekStart;
  final String muscle;
  final double volumeKg;

  const MuscleVolume({required this.weekStart, required this.muscle, required this.volumeKg});

  factory MuscleVolume.fromJson(Map<String, dynamic> json) => MuscleVolume(
        weekStart: DateTime.parse(json['week_start'] as String),
        muscle: json['muscle'] as String,
        volumeKg: (json['volume_kg'] as num).toDouble(),
      );
}

class ProgressionSessionPoint {
  final String workoutId;
  final DateTime date;
  final double weightKg;
  final int reps;

  const ProgressionSessionPoint({
    required this.workoutId,
    required this.date,
    required this.weightKg,
    required this.reps,
  });

  factory ProgressionSessionPoint.fromJson(Map<String, dynamic> json) => ProgressionSessionPoint(
        workoutId: json['workout_id'] as String,
        date: DateTime.parse(json['date'] as String),
        weightKg: (json['weight_kg'] as num).toDouble(),
        reps: json['reps'] as int,
      );
}

class ExerciseProgressionStats {
  final String exerciseId;
  final String exerciseName;
  final List<ProgressionSessionPoint> series;
  final double? bestWeightKg;
  final int? bestWeightReps;
  final double? bestEstimated1RmKg;
  final double totalVolumeKg;
  final int sessionCount;
  final DateTime? firstPerformedAt;
  final DateTime? lastPerformedAt;

  const ExerciseProgressionStats({
    required this.exerciseId,
    required this.exerciseName,
    required this.series,
    this.bestWeightKg,
    this.bestWeightReps,
    this.bestEstimated1RmKg,
    required this.totalVolumeKg,
    required this.sessionCount,
    this.firstPerformedAt,
    this.lastPerformedAt,
  });

  factory ExerciseProgressionStats.fromJson(Map<String, dynamic> json) => ExerciseProgressionStats(
        exerciseId: json['exercise_id'] as String,
        exerciseName: json['exercise_name'] as String,
        series: (json['series'] as List<dynamic>)
            .map((e) => ProgressionSessionPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
        bestWeightKg: (json['best_weight_kg'] as num?)?.toDouble(),
        bestWeightReps: json['best_weight_reps'] as int?,
        bestEstimated1RmKg: (json['best_estimated_1rm_kg'] as num?)?.toDouble(),
        totalVolumeKg: (json['total_volume_kg'] as num).toDouble(),
        sessionCount: json['session_count'] as int,
        firstPerformedAt:
            json['first_performed_at'] == null ? null : DateTime.parse(json['first_performed_at'] as String),
        lastPerformedAt:
            json['last_performed_at'] == null ? null : DateTime.parse(json['last_performed_at'] as String),
      );
}
