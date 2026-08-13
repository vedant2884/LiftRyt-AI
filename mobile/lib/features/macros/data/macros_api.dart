import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/providers.dart';
import 'models.dart';

/// Reuses the existing backend macro-calculation engine — no second
/// calorie/macro formula implemented client-side.
class MacrosApi {
  final Dio _dio;

  const MacrosApi(this._dio);

  Future<MacroTarget> calculate({required String goal, double? weightKg}) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/macros/calculate', data: {
        'goal': goal,
        'weight_kg': ?weightKg,
      });
      return MacroTarget.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<MacroTarget?> fetchActive() async {
    try {
      final res = await _dio.get<Map<String, dynamic>?>('/macros/active');
      return res.data == null ? null : MacroTarget.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<MacroTarget>> fetchHistory() async {
    try {
      final res = await _dio.get<List<dynamic>>('/macros/history');
      return res.data!.map((e) => MacroTarget.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final macrosApiProvider = Provider((ref) => MacrosApi(ref.watch(dioProvider)));
