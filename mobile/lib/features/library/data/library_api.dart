import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/providers.dart';
import 'models.dart';

class LibraryApi {
  final Dio _dio;

  const LibraryApi(this._dio);

  Future<List<LibraryExercise>> searchExercises({String? q, int limit = 50}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/exercises', queryParameters: {
        'q': ?q,
        'limit': limit,
      });
      final items = res.data!['items'] as List<dynamic>;
      return items.map((e) => LibraryExercise.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<FavoriteExercise>> fetchFavorites() async {
    try {
      final res = await _dio.get<List<dynamic>>('/exercises/favorites');
      return res.data!.map((e) => FavoriteExercise.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> addFavorite({String? exerciseId, String? customExerciseId}) async {
    try {
      await _dio.post('/exercises/favorites', data: {
        'exercise_id': ?exerciseId,
        'custom_exercise_id': ?customExerciseId,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> removeFavorite(String favoriteId) async {
    try {
      await _dio.delete('/exercises/favorites/$favoriteId');
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<LibraryExercise>> fetchCustomExercises({String? q}) async {
    try {
      final res = await _dio.get<List<dynamic>>('/exercises/custom', queryParameters: {'q': ?q});
      return res.data!.map((e) => LibraryExercise.fromJson(e as Map<String, dynamic>, isCustom: true)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> deleteCustomExercise(String id) async {
    try {
      await _dio.delete('/exercises/custom/$id');
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final libraryApiProvider = Provider((ref) => LibraryApi(ref.watch(dioProvider)));
