/// Centralized environment config — the one place a base URL is allowed to
/// live. Everything else asks [AppConfig.apiBaseUrl] rather than hardcoding
/// a host.
///
/// Override at build/run time with:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
/// (10.0.2.2 is how the Android emulator reaches the host machine's
/// localhost — a real device on the same network would use the host's LAN
/// IP instead.) With no override, the app talks to the production backend,
/// so a plain `flutter run` against a release build always does the right
/// thing.
class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://liftryt-backend.onrender.com',
  );
}
