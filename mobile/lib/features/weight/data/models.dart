// Mirrors backend/app/schemas/weight.py.

class WeightLog {
  final String id;
  final double weightKg;
  final DateTime loggedAt;
  final String? note;

  const WeightLog({required this.id, required this.weightKg, required this.loggedAt, this.note});

  factory WeightLog.fromJson(Map<String, dynamic> json) => WeightLog(
        id: json['id'] as String,
        weightKg: (json['weight_kg'] as num).toDouble(),
        loggedAt: DateTime.parse(json['logged_at'] as String),
        note: json['note'] as String?,
      );
}

class WeightSeriesPoint {
  final DateTime loggedAt;
  final double weightKg;
  final double? movingAvg7d;

  const WeightSeriesPoint({required this.loggedAt, required this.weightKg, this.movingAvg7d});

  factory WeightSeriesPoint.fromJson(Map<String, dynamic> json) => WeightSeriesPoint(
        loggedAt: DateTime.parse(json['logged_at'] as String),
        weightKg: (json['weight_kg'] as num).toDouble(),
        movingAvg7d: (json['moving_avg_7d'] as num?)?.toDouble(),
      );
}

class WeightTrend {
  final double? rateKgPerWeek;
  final DateTime? projectedGoalDate;
  final double? goalWeightKg;

  const WeightTrend({this.rateKgPerWeek, this.projectedGoalDate, this.goalWeightKg});

  factory WeightTrend.fromJson(Map<String, dynamic> json) => WeightTrend(
        rateKgPerWeek: (json['rate_kg_per_week'] as num?)?.toDouble(),
        projectedGoalDate:
            json['projected_goal_date'] == null ? null : DateTime.parse(json['projected_goal_date'] as String),
        goalWeightKg: (json['goal_weight_kg'] as num?)?.toDouble(),
      );
}

class WeightAnalytics {
  final double? currentWeightKg;
  final List<WeightSeriesPoint> series;
  final WeightTrend trend;

  const WeightAnalytics({this.currentWeightKg, required this.series, required this.trend});

  factory WeightAnalytics.fromJson(Map<String, dynamic> json) => WeightAnalytics(
        currentWeightKg: (json['current_weight_kg'] as num?)?.toDouble(),
        series: (json['series'] as List<dynamic>)
            .map((e) => WeightSeriesPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
        trend: WeightTrend.fromJson(json['trend'] as Map<String, dynamic>),
      );
}
