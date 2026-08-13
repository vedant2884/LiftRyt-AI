// Mirrors backend/app/schemas/macro.py.

class MacroTarget {
  final String id;
  final double bmr;
  final double tdee;
  final String goal;
  final double targetCalories;
  final double targetProteinG;
  final double targetCarbsG;
  final double targetFatG;
  final bool isActive;
  final DateTime createdAt;

  const MacroTarget({
    required this.id,
    required this.bmr,
    required this.tdee,
    required this.goal,
    required this.targetCalories,
    required this.targetProteinG,
    required this.targetCarbsG,
    required this.targetFatG,
    required this.isActive,
    required this.createdAt,
  });

  factory MacroTarget.fromJson(Map<String, dynamic> json) => MacroTarget(
        id: json['id'] as String,
        bmr: (json['bmr'] as num).toDouble(),
        tdee: (json['tdee'] as num).toDouble(),
        goal: json['goal'] as String,
        targetCalories: (json['target_calories'] as num).toDouble(),
        targetProteinG: (json['target_protein_g'] as num).toDouble(),
        targetCarbsG: (json['target_carbs_g'] as num).toDouble(),
        targetFatG: (json['target_fat_g'] as num).toDouble(),
        isActive: json['is_active'] as bool,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}
