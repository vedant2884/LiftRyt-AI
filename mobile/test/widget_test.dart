import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:liftryt/core/theme/app_theme.dart';
import 'package:liftryt/features/auth/presentation/login_screen.dart';

void main() {
  // Pumps LoginScreen directly (rather than the full LiftRytApp) so this
  // test doesn't need a real/mocked Dio+network stack just to render a
  // form — it only touches the API client inside _submit, which this test
  // never triggers.
  testWidgets('LoginScreen renders email/password fields and a submit button', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.dark,
          home: LoginScreen(onGoToSignup: () {}, onGoToForgotPassword: () {}),
        ),
      ),
    );

    expect(find.text('Log in'), findsWidgets);
    expect(find.widgetWithText(TextFormField, 'Email'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Password'), findsOneWidget);
    expect(find.text('Remember me'), findsOneWidget);
    expect(find.text('Sign up'), findsOneWidget);
  });
}
