import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'features/auth/presentation/auth_flow.dart';
import 'features/auth/state/auth_controller.dart';
import 'features/navigation/presentation/main_shell.dart';

class LiftRytApp extends StatelessWidget {
  const LiftRytApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LiftRyt',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      darkTheme: AppTheme.dark,
      home: const AuthGate(),
    );
  }
}

/// Three states, exactly mirroring `frontend/src/components/ProtectedRoute.tsx`:
/// bootstrapping (silent-refresh in flight) -> unauthenticated -> authenticated.
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    if (auth.isBootstrapping) {
      return const Scaffold(
        body: Center(
          child: Text('Loading...', style: TextStyle(color: AppColors.inkSecondary)),
        ),
      );
    }

    return auth.isAuthenticated ? const MainShell() : const AuthFlow();
  }
}
