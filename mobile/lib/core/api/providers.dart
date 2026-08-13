import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/data/auth_api.dart';

/// Overridden in `main()` once the async-initialized Dio instance (needs a
/// filesystem directory for the persisted cookie jar, see `api_client.dart`)
/// is ready — every other provider that needs network access reads through
/// here rather than constructing its own Dio.
final dioProvider = Provider<Dio>((ref) {
  throw UnimplementedError('dioProvider must be overridden in main() before runApp');
});

final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.watch(dioProvider)));
