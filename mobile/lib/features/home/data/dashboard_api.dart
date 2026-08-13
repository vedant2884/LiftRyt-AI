import 'package:dio/dio.dart';

import '../../../core/api/api_exception.dart';
import 'models.dart';

/// Reuses the exact same backend endpoints the web dashboard/Analysis pages
/// already call (`/streaks`, `/weight-logs/analytics`, `/workouts`,
/// `/workouts/prs`, `/splits/active`) — no new endpoints, no client-side
/// recalculation of anything the backend already computes.
class DashboardApi {
  final Dio _dio;

  const DashboardApi(this._dio);

  Future<Streaks> fetchStreaks() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/streaks');
      return Streaks.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<WeightSummary> fetchWeightSummary() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/weight-logs/analytics');
      return WeightSummary.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<WorkoutSummary?> fetchLastWorkout() async {
    try {
      final res = await _dio.get<List<dynamic>>('/workouts');
      final list = res.data!;
      if (list.isEmpty) return null;
      return WorkoutSummary.fromJson(list.first as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  /// Most recent PR by date — `/workouts/prs` returns one row per exercise
  /// (its all-time best), not sorted by recency, so recency ordering is
  /// picked here for display purposes only; the PR values themselves are
  /// entirely backend-computed.
  Future<PersonalRecord?> fetchMostRecentPr() async {
    try {
      final res = await _dio.get<List<dynamic>>('/workouts/prs');
      final records =
          res.data!.map((e) => PersonalRecord.fromJson(e as Map<String, dynamic>)).toList();
      if (records.isEmpty) return null;
      records.sort((a, b) => b.performedAt.compareTo(a.performedAt));
      return records.first;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ActiveSplit?> fetchActiveSplit() async {
    try {
      final res = await _dio.get<Map<String, dynamic>?>('/splits/active');
      if (res.data == null) return null;
      return ActiveSplit.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<DashboardData> fetchDashboard() async {
    final results = await Future.wait([
      fetchStreaks(),
      fetchWeightSummary(),
      fetchLastWorkout(),
      fetchMostRecentPr(),
      fetchActiveSplit(),
    ]);
    return DashboardData(
      streaks: results[0] as Streaks,
      weight: results[1] as WeightSummary,
      lastWorkout: results[2] as WorkoutSummary?,
      recentPr: results[3] as PersonalRecord?,
      activeSplit: results[4] as ActiveSplit?,
    );
  }
}
