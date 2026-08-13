// Mirrors backend/app/schemas/exercise.py — lean subset the mobile Library
// screens need (browsing, favoriting, custom exercises), not every
// instructional field the backend can return.

class LibraryExercise {
  final String id;
  final bool isCustom;
  final String name;
  final String? description;
  final List<String> primaryMuscles;
  final List<String> secondaryMuscles;
  final String equipment;
  final String movementType;
  final String category;
  final String difficulty;

  const LibraryExercise({
    required this.id,
    required this.isCustom,
    required this.name,
    this.description,
    required this.primaryMuscles,
    required this.secondaryMuscles,
    required this.equipment,
    required this.movementType,
    required this.category,
    required this.difficulty,
  });

  factory LibraryExercise.fromJson(Map<String, dynamic> json, {bool isCustom = false}) => LibraryExercise(
        id: json['id'] as String,
        isCustom: isCustom,
        name: json['name'] as String,
        description: json['description'] as String?,
        primaryMuscles: (json['primary_muscles'] as List<dynamic>).cast<String>(),
        secondaryMuscles: (json['secondary_muscles'] as List<dynamic>? ?? []).cast<String>(),
        equipment: json['equipment'] as String,
        movementType: json['movement_type'] as String,
        category: json['category'] as String,
        difficulty: json['difficulty'] as String,
      );
}

class FavoriteExercise {
  final String id;
  final String? exerciseId;
  final String? customExerciseId;
  final bool isCustom;
  final String name;
  final List<String> primaryMuscles;
  final String equipment;

  const FavoriteExercise({
    required this.id,
    this.exerciseId,
    this.customExerciseId,
    required this.isCustom,
    required this.name,
    required this.primaryMuscles,
    required this.equipment,
  });

  String get targetId => isCustom ? customExerciseId! : exerciseId!;

  factory FavoriteExercise.fromJson(Map<String, dynamic> json) => FavoriteExercise(
        id: json['id'] as String,
        exerciseId: json['exercise_id'] as String?,
        customExerciseId: json['custom_exercise_id'] as String?,
        isCustom: json['is_custom'] as bool,
        name: json['name'] as String,
        primaryMuscles: (json['primary_muscles'] as List<dynamic>).cast<String>(),
        equipment: json['equipment'] as String,
      );
}
