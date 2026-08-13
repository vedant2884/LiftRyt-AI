import 'package:dio/dio.dart';

/// Normalizes every failure mode Dio can throw (timeouts, no connection, a
/// non-2xx response, a malformed body) into one shape the UI can display
/// directly — mirrors the frontend's `isAxiosError<{detail?: string}>(err)`
/// pattern of reading the backend's `{"detail": "..."}` error body.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  const ApiException(this.message, {this.statusCode});

  factory ApiException.fromDioException(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiException('The connection timed out. Please try again.');
      case DioExceptionType.connectionError:
        return const ApiException('No internet connection. Please check your network and try again.');
      case DioExceptionType.cancel:
        return const ApiException('Request cancelled.');
      case DioExceptionType.badResponse:
        final status = e.response?.statusCode;
        final data = e.response?.data;
        final detail = data is Map ? data['detail'] : null;
        return ApiException(
          detail is String ? detail : 'Something went wrong. Please try again.',
          statusCode: status,
        );
      case DioExceptionType.badCertificate:
        return const ApiException('Couldn\'t establish a secure connection.');
      case DioExceptionType.unknown:
        return const ApiException('Something went wrong. Please try again.');
    }
  }

  @override
  String toString() => message;
}
