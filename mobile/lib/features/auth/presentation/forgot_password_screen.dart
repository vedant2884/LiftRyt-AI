import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/primary_button.dart';
import '../state/auth_controller.dart';

/// Mirrors `frontend/src/pages/ForgotPasswordPage.tsx`. Completing the reset
/// (tapping the emailed link) still happens on the web's
/// `/reset-password?token=...` page for now — deep-linking that link
/// straight into this app is a deferred follow-up, not silently dropped;
/// see the Phase 2 summary.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  final VoidCallback onBackToLogin;

  const ForgotPasswordScreen({super.key, required this.onBackToLogin});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;
  String? _devResetLink;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final link = await ref.read(authControllerProvider.notifier).forgotPassword(_emailController.text.trim());
      setState(() {
        _devResetLink = link;
        _sent = true;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Reset your password',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: AppColors.ink),
                ),
                const SizedBox(height: 20),
                if (_sent) ...[
                  Text(
                    'If an account exists for ${_emailController.text.trim()}, a reset link has been sent. '
                    'Check your inbox.',
                    style: const TextStyle(color: AppColors.inkSecondary, fontSize: 14),
                  ),
                  if (_devResetLink != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Dev mode: no email provider is configured',
                            style: TextStyle(color: Color(0xFFFBBF24), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Open this link in a browser to finish resetting your password:',
                            style: TextStyle(color: AppColors.inkSecondary, fontSize: 12),
                          ),
                          const SizedBox(height: 4),
                          SelectableText(
                            _devResetLink!,
                            style: const TextStyle(color: AppColors.accent, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ] else ...[
                  const Text(
                    'Enter the email on your account and we will send you a link to reset your password.',
                    style: TextStyle(color: AppColors.inkSecondary, fontSize: 14),
                  ),
                  const SizedBox(height: 16),
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_error != null) ...[
                          Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 13)),
                          const SizedBox(height: 12),
                        ],
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          decoration: const InputDecoration(labelText: 'Email'),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Email is required' : null,
                          onFieldSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 16),
                        PrimaryButton(
                          label: 'Send reset link',
                          loadingLabel: 'Sending...',
                          loading: _loading,
                          onPressed: _submit,
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                Center(
                  child: TextButton(
                    onPressed: widget.onBackToLogin,
                    child: const Text('Back to log in'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
