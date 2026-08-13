import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Overridden in `main()` once `SharedPreferences.getInstance()` resolves —
/// same pattern as `dioProvider`. Used for local-only state that must
/// survive an app kill (active workout draft), not anything the backend is
/// the source of truth for.
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('sharedPreferencesProvider must be overridden in main() before runApp');
});
