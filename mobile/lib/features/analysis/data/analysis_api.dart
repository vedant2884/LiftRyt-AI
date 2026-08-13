import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/providers.dart';
import '../../workouts/data/models.dart' show WorkoutSummary;
import 'models.dart';

/// Reuses the same backend endpoints the web Analysis page calls — no
/// client-side recalculation of anything the backend already computes.
class AnalysisApi {
  final Dio _dio;

  const AnalysisApi(this._dio);

  Future<WorkoutOverview> fetchOverview() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/workouts/analysis/overview');
      return WorkoutOverview.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<PersonalRecord>> fetchPersonalRecords() async {
    try {
      final res = await _dio.get<List<dynamic>>('/workouts/prs');
      return res.data!.map((e) => PersonalRecord.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<WeeklyVolume>> fetchWeeklyVolume() async {
    try {
      final res = await _dio.get<List<dynamic>>('/workouts/volume');
      return res.data!.map((e) => WeeklyVolume.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<MuscleVolume>> fetchMuscleVolume() async {
    try {
      final res = await _dio.get<List<dynamic>>('/workouts/volume/muscles');
      return res.data!.map((e) => MuscleVolume.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ExerciseProgressionStats> fetchExerciseProgression(String exerciseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/workouts/analysis/progression/$exerciseId');
      return ExerciseProgressionStats.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<WorkoutSummary>> fetchHistory() async {
    try {
      final res = await _dio.get<List<dynamic>>('/workouts');
      return res.data!.map((e) => WorkoutSummary.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final analysisApiProvider = Provider((ref) => AnalysisApi(ref.watch(dioProvider)));
