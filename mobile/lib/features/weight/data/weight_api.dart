import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/providers.dart';
import 'models.dart';

class WeightApi {
  final Dio _dio;

  const WeightApi(this._dio);

  Future<WeightLog> logWeight({required double weightKg, DateTime? loggedAt, String? note}) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/weight-logs', data: {
        'weight_kg': weightKg,
        'logged_at': ?loggedAt?.toIso8601String().split('T').first,
        'note': ?note,
      });
      return WeightLog.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<WeightLog>> listLogs() async {
    try {
      final res = await _dio.get<List<dynamic>>('/weight-logs');
      return res.data!.map((e) => WeightLog.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<WeightAnalytics> fetchAnalytics() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/weight-logs/analytics');
      return WeightAnalytics.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> deleteLog(String id) async {
    try {
      await _dio.delete('/weight-logs/$id');
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final weightApiProvider = Provider((ref) => WeightApi(ref.watch(dioProvider)));
