import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/auth_session.dart';
import '../../../core/api/providers.dart';
import '../data/auth_api.dart';
import '../data/models.dart';

class AuthState {
  final bool isBootstrapping;
  final UserProfile? user;

  const AuthState({this.isBootstrapping = true, this.user});

  bool get isAuthenticated => user != null;
}

/// App-wide auth state — mirrors `frontend/src/store/authStore.ts` plus the
/// silent-refresh-on-launch bootstrap from `frontend/src/App.tsx`:
/// the access token itself is never persisted to disk (kept only in
/// [authSession], in memory), session persistence instead comes from the
/// refresh cookie the Dio cookie jar already keeps on disk, exactly like the
/// browser's httpOnly cookie.
class AuthController extends Notifier<AuthState> {
  late final AuthApi _authApi;

  @override
  AuthState build() {
    _authApi = ref.read(authApiProvider);

    // The API client's 401-retry interceptor also refreshes the token
    // outside of any explicit call the UI makes — these hooks keep this
    // provider's state in sync with whatever the interceptor just did.
    authSession.onTokenRefreshed = (accessToken, userJson) {
      state = AuthState(isBootstrapping: false, user: UserProfile.fromJson(userJson));
    };
    authSession.onSessionExpired = () {
      state = const AuthState(isBootstrapping: false, user: null);
    };

    _bootstrap();
    return const AuthState(isBootstrapping: true, user: null);
  }

  Future<void> _bootstrap() async {
    try {
      final result = await _authApi.refresh();
      authSession.accessToken = result.accessToken;
      state = AuthState(isBootstrapping: false, user: result.user);
    } catch (_) {
      // No valid refresh cookie (never logged in, or it expired/was
      // revoked) — a normal, expected outcome, not an error.
      state = const AuthState(isBootstrapping: false, user: null);
    }
  }

  Future<void> signup(SignupPayload payload) async {
    final result = await _authApi.signup(payload);
    authSession.accessToken = result.accessToken;
    state = AuthState(isBootstrapping: false, user: result.user);
  }

  Future<void> login({required String email, required String password, bool rememberMe = true}) async {
    final result = await _authApi.login(email: email, password: password, rememberMe: rememberMe);
    authSession.accessToken = result.accessToken;
    state = AuthState(isBootstrapping: false, user: result.user);
  }

  /// Returns the dev-only reset link (see `ForgotPasswordResponse` on the
  /// backend) so the UI can surface it when no email provider is configured;
  /// always null in production.
  Future<String?> forgotPassword(String email) => _authApi.forgotPassword(email);

  Future<void> updateProfile({double? defaultProgressionIncrementKg}) async {
    final updated = await _authApi.updateProfile(defaultProgressionIncrementKg: defaultProgressionIncrementKg);
    state = AuthState(isBootstrapping: false, user: updated);
  }

  Future<void> logout() async {
    await _authApi.logout();
    authSession.accessToken = null;
    state = const AuthState(isBootstrapping: false, user: null);
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
