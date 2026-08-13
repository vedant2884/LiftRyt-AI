import 'package:dio/dio.dart';

import '../../../core/api/api_exception.dart';
import 'models.dart';

/// Mirrors `frontend/src/api/workouts.ts` — same endpoints, same shapes.
class WorkoutsApi {
  final Dio _dio;

  const WorkoutsApi(this._dio);

  Future<WorkoutSummary> createWorkout({required String name, required DateTime performedAt}) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/workouts', data: {
        'name': name,
        'performed_at': performedAt.toUtc().toIso8601String(),
      });
      return WorkoutSummary.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<WorkoutSummary>> listWorkouts() async {
    try {
      final res = await _dio.get<List<dynamic>>('/workouts');
      return res.data!.map((e) => WorkoutSummary.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<WorkoutDetail> getWorkout(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/workouts/$id');
      return WorkoutDetail.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> updateWorkout(String id, {int? durationSeconds, String? name}) async {
    try {
      await _dio.patch('/workouts/$id', data: {
        'duration_seconds': ?durationSeconds,
        'name': ?name,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> deleteWorkout(String id) async {
    try {
      await _dio.delete('/workouts/$id');
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<WorkoutSet> addSet({
    required String workoutId,
    String? exerciseId,
    String? customExerciseId,
    required double weightKg,
    required int reps,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/workouts/$workoutId/sets', data: {
        'exercise_id': ?exerciseId,
        'custom_exercise_id': ?customExerciseId,
        'weight_kg': weightKg,
        'reps': reps,
      });
      return WorkoutSet.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> deleteSet(String workoutId, String setId) async {
    try {
      await _dio.delete('/workouts/$workoutId/sets/$setId');
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<RecentExercise>> fetchRecentExercises({int limit = 10}) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/workouts/recent-exercises',
        queryParameters: {'limit': limit},
      );
      return res.data!.map((e) => RecentExercise.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
