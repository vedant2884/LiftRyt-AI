import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/providers.dart';
import 'models.dart';

/// Mirrors `frontend/src/api/splits.ts` — reuses the existing split
/// generation/activation backend, no separate mobile split engine.
class SplitsApi {
  final Dio _dio;

  const SplitsApi(this._dio);

  Future<SplitPlan> generateSplit({
    required int daysPerWeek,
    required String experienceLevel,
    required String goal,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/splits/generate', data: {
        'days_per_week': daysPerWeek,
        'experience_level': experienceLevel,
        'goal': goal,
      });
      return SplitPlan.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<SplitPlan?> fetchActiveSplit() async {
    try {
      final res = await _dio.get<Map<String, dynamic>?>('/splits/active');
      return res.data == null ? null : SplitPlan.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<SplitSummary>> listSplits() async {
    try {
      final res = await _dio.get<List<dynamic>>('/splits');
      return res.data!.map((e) => SplitSummary.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<SplitPlan> activateSplit(String splitId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/splits/$splitId/activate');
      return SplitPlan.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<bool> toggleDayComplete(String splitId, int dayIndex) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/splits/$splitId/days/$dayIndex/toggle-complete');
      return res.data!['completed'] as bool;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final splitsApiProvider = Provider((ref) => SplitsApi(ref.watch(dioProvider)));
