import 'package:dio/dio.dart';

import '../../../core/api/api_exception.dart';
import 'models.dart';

/// Covers `/exercises`, `/exercises/custom`, `/exercises/favorites` — the
/// subset the workout logger's exercise picker needs. The full Exercise
/// Library browsing experience (filters, exercise detail) is Phase 8.
class ExercisesApi {
  final Dio _dio;

  const ExercisesApi(this._dio);

  Future<List<PickerExercise>> searchExercises(String query, {int limit = 12}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/exercises', queryParameters: {
        'q': query,
        'limit': limit,
      });
      final items = res.data!['items'] as List<dynamic>;
      return items
          .map((e) => _fromExerciseJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<PickerExercise>> searchCustomExercises(String query) async {
    try {
      final res = await _dio.get<List<dynamic>>('/exercises/custom', queryParameters: {'q': query});
      return res.data!.map((e) => _fromCustomJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<PickerExercise>> fetchFavorites() async {
    try {
      final res = await _dio.get<List<dynamic>>('/exercises/favorites');
      return res.data!.map((f) {
        final map = f as Map<String, dynamic>;
        final isCustom = map['is_custom'] as bool;
        return PickerExercise(
          id: (isCustom ? map['custom_exercise_id'] : map['exercise_id']) as String,
          isCustom: isCustom,
          name: map['name'] as String,
          primaryMuscles: (map['primary_muscles'] as List<dynamic>).cast<String>(),
          equipment: map['equipment'] as String,
        );
      }).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<PickerExercise> createCustomExercise({
    required String name,
    required List<String> primaryMuscles,
    required String equipment,
    required String movementType,
    required String category,
    required String difficulty,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/exercises/custom', data: {
        'name': name,
        'primary_muscles': primaryMuscles,
        'equipment': equipment,
        'movement_type': movementType,
        'category': category,
        'difficulty': difficulty,
      });
      return _fromCustomJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  PickerExercise _fromExerciseJson(Map<String, dynamic> json) => PickerExercise(
        id: json['id'] as String,
        isCustom: false,
        name: json['name'] as String,
        primaryMuscles: (json['primary_muscles'] as List<dynamic>).cast<String>(),
        equipment: json['equipment'] as String,
      );

  PickerExercise _fromCustomJson(Map<String, dynamic> json) => PickerExercise(
        id: json['id'] as String,
        isCustom: true,
        name: json['name'] as String,
        primaryMuscles: (json['primary_muscles'] as List<dynamic>).cast<String>(),
        equipment: json['equipment'] as String,
      );
}
