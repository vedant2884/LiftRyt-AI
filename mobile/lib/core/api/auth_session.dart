/// Plain, non-reactive holder for the current access token, read
/// synchronously by the Dio interceptor on every request — mirrors the web
/// app's `useAuthStore.getState()` call inside `frontend/src/lib/api.ts`,
/// which reads the Zustand store directly rather than through a hook so the
/// interceptor (outside the widget tree) always sees the latest value.
///
/// [AuthController] is the source of truth and keeps this mirrored; nothing
/// else should write to it.
class AuthSession {
  String? accessToken;

  /// Called by the API client after a successful silent refresh, so
  /// [AuthController]'s Riverpod state stays in sync with the token this
  /// object is now holding.
  void Function(String accessToken, Map<String, dynamic> user)? onTokenRefreshed;

  /// Called when a refresh attempt fails (expired/revoked/missing cookie) —
  /// the app should treat this exactly like an explicit logout.
  void Function()? onSessionExpired;
}

final authSession = AuthSession();
