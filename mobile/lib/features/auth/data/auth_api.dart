import 'package:dio/dio.dart';

import '../../../core/api/api_exception.dart';
import 'models.dart';

/// Thin wrapper over the `/auth/*` endpoints — no business logic beyond
/// request/response shaping, matching `frontend/src/api/auth.ts`'s role.
class AuthApi {
  final Dio _dio;

  const AuthApi(this._dio);

  Future<AuthResult> signup(SignupPayload payload) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/auth/signup', data: payload.toJson());
      return AuthResult.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<AuthResult> login({
    required String email,
    required String password,
    bool rememberMe = true,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/auth/login', data: {
        'email': email,
        'password': password,
        'remember_me': rememberMe,
      });
      return AuthResult.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  /// Reads the refresh cookie (persisted by the Dio cookie jar, same as the
  /// browser's httpOnly cookie) and returns a fresh access token — used both
  /// for silent session restore on app start and by the 401 interceptor.
  Future<AuthResult> refresh() async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/auth/refresh');
      return AuthResult.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } on DioException {
      // Logout is best-effort from the client's perspective — the local
      // session is cleared regardless (see AuthController.logout).
    }
  }

  Future<String?> forgotPassword(String email) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('/auth/forgot-password', data: {
        'email': email,
      });
      return res.data?['dev_reset_link'] as String?;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<UserProfile> updateProfile({double? defaultProgressionIncrementKg}) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>('/auth/me', data: {
        'default_progression_increment_kg': ?defaultProgressionIncrementKg,
      });
      return UserProfile.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}
