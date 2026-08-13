import 'dart:async';
import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';

import '../config/app_config.dart';
import 'auth_session.dart';

/// Endpoints where a 401 means "this credential itself is invalid," not
/// "the access token expired" — retrying with a refreshed token would be
/// meaningless (or, for /auth/refresh, would recurse). Mirrors
/// `frontend/src/lib/api.ts`'s NO_REFRESH_RETRY exactly.
final _noRefreshRetry = RegExp(r'/auth/(login|signup|refresh)$');

/// Builds the app's single Dio instance. Async because the persisted cookie
/// jar (needed so the httpOnly-equivalent refresh cookie survives an app
/// restart, matching the browser's own cookie jar) needs a filesystem
/// directory that's only available after the Flutter engine is ready.
Future<Dio> createApiClient() async {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  final docsDir = await getApplicationDocumentsDirectory();
  final cookieJar = PersistCookieJar(
    storage: FileStorage('${docsDir.path}${Platform.pathSeparator}.cookies'),
  );
  dio.interceptors.add(CookieManager(cookieJar));

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = authSession.accessToken;
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final requestPath = error.requestOptions.path;
        final alreadyRetried = error.requestOptions.extra['retried'] == true;

        if (error.response?.statusCode == 401 &&
            !alreadyRetried &&
            !_noRefreshRetry.hasMatch(requestPath)) {
          final newToken = await _refreshAccessToken(dio);
          if (newToken != null) {
            final retryOptions = error.requestOptions
              ..headers['Authorization'] = 'Bearer $newToken'
              ..extra['retried'] = true;
            try {
              final response = await dio.fetch(retryOptions);
              return handler.resolve(response);
            } on DioException catch (retryError) {
              return handler.next(retryError);
            }
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
}

/// Concurrent 401s (several requests firing right as the access token
/// expires) must share one refresh call rather than each racing their own —
/// otherwise every refresh after the first would replay an already-rotated,
/// now-revoked cookie and fail. Same reasoning as the web client's
/// `refreshInFlight` promise.
Future<String?>? _refreshInFlight;

Future<String?> _refreshAccessToken(Dio dio) {
  return _refreshInFlight ??= _doRefresh(dio).whenComplete(() {
    _refreshInFlight = null;
  });
}

Future<String?> _doRefresh(Dio dio) async {
  try {
    final response = await dio.post<Map<String, dynamic>>('/auth/refresh');
    final data = response.data!;
    final accessToken = data['access_token'] as String;
    final user = data['user'] as Map<String, dynamic>;
    authSession.accessToken = accessToken;
    authSession.onTokenRefreshed?.call(accessToken, user);
    return accessToken;
  } on DioException {
    authSession.accessToken = null;
    authSession.onSessionExpired?.call();
    return null;
  }
}
