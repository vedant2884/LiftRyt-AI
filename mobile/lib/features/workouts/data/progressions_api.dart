import 'package:dio/dio.dart';

import '../../../core/api/api_exception.dart';
import 'models.dart';

/// Mirrors `frontend/src/api/progressions.ts` — the existing PR-progression
/// backend, never reimplemented client-side.
class ProgressionsApi {
  final Dio _dio;

  const ProgressionsApi(this._dio);

  Future<List<ExerciseProgression>> fetchProgressions() async {
    try {
      final res = await _dio.get<List<dynamic>>('/exercises/progressions');
      return res.data!.map((e) => ExerciseProgression.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  /// Explicit user confirmation of "increase next weight?" — never called
  /// automatically.
  Future<ExerciseProgression> confirmProgression({
    required String exerciseId,
    required double prWeightKg,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/exercises/progressions/confirm', data: {
        'exercise_id': exerciseId,
        'pr_weight_kg': prWeightKg,
      });
      return ExerciseProgression.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ExerciseProgression> updateProgression({
    required String exerciseId,
    double? incrementKg,
    bool? enabled,
    bool clearSuggestion = false,
  }) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>('/exercises/progressions', data: {
        'exercise_id': exerciseId,
        'increment_kg': ?incrementKg,
        'enabled': ?enabled,
        'clear_suggestion': clearSuggestion,
      });
      return ExerciseProgression.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
