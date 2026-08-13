import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/providers.dart';
import 'models.dart';

/// Mirrors `frontend/src/api/chat.ts` — the existing backend/Groq
/// integration, never a second AI client. The Groq API key never enters
/// this app; every call here is a plain authenticated request to our own
/// backend.
class CoachApi {
  final Dio _dio;

  const CoachApi(this._dio);

  Future<List<ChatSession>> fetchSessions() async {
    try {
      final res = await _dio.get<List<dynamic>>('/chat/sessions');
      return res.data!.map((e) => ChatSession.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ChatSession> createSession() async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/chat/sessions');
      return ChatSession.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<ChatMessage>> fetchMessages(String sessionId) async {
    try {
      final res = await _dio.get<List<dynamic>>('/chat/sessions/$sessionId/messages');
      return res.data!.map((e) => ChatMessage.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ChatMessage> sendMessage(String sessionId, String content) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/chat/sessions/$sessionId/messages',
        data: {'content': content},
      );
      return ChatMessage.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ChatMessage> requestWeeklyCheckin(String sessionId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/chat/sessions/$sessionId/weekly-checkin');
      return ChatMessage.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final coachApiProvider = Provider((ref) => CoachApi(ref.watch(dioProvider)));
