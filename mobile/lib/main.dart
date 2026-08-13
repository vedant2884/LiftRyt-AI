import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/api/api_client.dart';
import 'core/api/providers.dart';
import 'core/storage/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Built once up front (needs a filesystem directory for the persisted
  // cookie jar — see api_client.dart) and handed to every provider that
  // makes network calls via dioProvider's override below.
  final dio = await createApiClient();
  final prefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [
        dioProvider.overrideWithValue(dio),
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: const LiftRytApp(),
    ),
  );
}
