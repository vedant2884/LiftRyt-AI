import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/auth_error_banner.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/models.dart';
import '../state/auth_controller.dart';

/// Mirrors `frontend/src/pages/SignupPage.tsx`'s fields and validation
/// exactly (same required/optional split, same enum options) — stacked
/// single-column instead of the web's grid layout, since that's the
/// mobile-native way to fill a long form rather than shrinking a desktop
/// grid onto a phone.
class SignupScreen extends ConsumerStatefulWidget {
  final VoidCallback onGoToLogin;

  const SignupScreen({super.key, required this.onGoToLogin});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _ageController = TextEditingController();
  final _heightController = TextEditingController();
  final _startingWeightController = TextEditingController();
  final _goalWeightController = TextEditingController();

  Sex _sex = Sex.male;
  ActivityLevel _activityLevel = ActivityLevel.moderate;
  ExperienceLevel _trainingExperience = ExperienceLevel.beginner;
  DietaryPreference _dietaryPreference = DietaryPreference.none;

  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _fullNameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _ageController.dispose();
    _heightController.dispose();
    _startingWeightController.dispose();
    _goalWeightController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final payload = SignupPayload(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        fullName: _fullNameController.text.trim(),
        username: _usernameController.text.trim(),
        age: int.parse(_ageController.text),
        sex: _sex,
        heightCm: double.parse(_heightController.text),
        goalWeightKg: double.parse(_goalWeightController.text),
        startingWeightKg:
            _startingWeightController.text.isEmpty ? null : double.parse(_startingWeightController.text),
        activityLevel: _activityLevel,
        trainingExperience: _trainingExperience,
        dietaryPreference: _dietaryPreference,
      );
      await ref.read(authControllerProvider.notifier).signup(payload);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create your account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  AuthErrorBanner(message: _error!),
                  const SizedBox(height: 16),
                ],
                _field(_fullNameController, 'Full name', validator: _requiredValidator),
                _spacer,
                _field(
                  _usernameController,
                  'Username',
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Username is required';
                    if (!RegExp(r'^[a-zA-Z0-9_]{3,30}$').hasMatch(v)) {
                      return '3-30 characters: letters, numbers, underscores';
                    }
                    return null;
                  },
                ),
                _spacer,
                _field(
                  _emailController,
                  'Email',
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  validator: _requiredValidator,
                ),
                _spacer,
                _field(
                  _passwordController,
                  'Password',
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null,
                ),
                _spacer,
                Row(
                  children: [
                    Expanded(
                      child: _field(
                        _ageController,
                        'Age',
                        keyboardType: TextInputType.number,
                        validator: (v) {
                          final n = int.tryParse(v ?? '');
                          if (n == null || n < 13 || n > 120) return 'Invalid';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _field(
                        _heightController,
                        'Height (cm)',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (v) {
                          final n = double.tryParse(v ?? '');
                          if (n == null || n <= 0 || n > 300) return 'Invalid';
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                _spacer,
                DropdownButtonFormField<Sex>(
                  initialValue: _sex,
                  decoration: const InputDecoration(labelText: 'Sex'),
                  items: const [
                    DropdownMenuItem(value: Sex.male, child: Text('Male')),
                    DropdownMenuItem(value: Sex.female, child: Text('Female')),
                    DropdownMenuItem(value: Sex.other, child: Text('Other')),
                  ],
                  onChanged: (v) => setState(() => _sex = v ?? Sex.male),
                ),
                _spacer,
                Row(
                  children: [
                    Expanded(
                      child: _field(
                        _startingWeightController,
                        'Current weight (kg, optional)',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (v) {
                          if (v == null || v.isEmpty) return null;
                          final n = double.tryParse(v);
                          if (n == null || n <= 0 || n > 500) return 'Invalid';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _field(
                        _goalWeightController,
                        'Goal weight (kg)',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (v) {
                          final n = double.tryParse(v ?? '');
                          if (n == null || n <= 0 || n > 500) return 'Invalid';
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                _spacer,
                DropdownButtonFormField<ActivityLevel>(
                  initialValue: _activityLevel,
                  decoration: const InputDecoration(labelText: 'Activity level'),
                  items: const [
                    DropdownMenuItem(value: ActivityLevel.sedentary, child: Text('Sedentary')),
                    DropdownMenuItem(value: ActivityLevel.light, child: Text('Light')),
                    DropdownMenuItem(value: ActivityLevel.moderate, child: Text('Moderate')),
                    DropdownMenuItem(value: ActivityLevel.active, child: Text('Active')),
                    DropdownMenuItem(value: ActivityLevel.veryActive, child: Text('Very active')),
                  ],
                  onChanged: (v) => setState(() => _activityLevel = v ?? ActivityLevel.moderate),
                ),
                _spacer,
                DropdownButtonFormField<ExperienceLevel>(
                  initialValue: _trainingExperience,
                  decoration: const InputDecoration(labelText: 'Training experience'),
                  items: const [
                    DropdownMenuItem(value: ExperienceLevel.beginner, child: Text('Beginner')),
                    DropdownMenuItem(value: ExperienceLevel.intermediate, child: Text('Intermediate')),
                    DropdownMenuItem(value: ExperienceLevel.advanced, child: Text('Advanced')),
                  ],
                  onChanged: (v) => setState(() => _trainingExperience = v ?? ExperienceLevel.beginner),
                ),
                _spacer,
                DropdownButtonFormField<DietaryPreference>(
                  initialValue: _dietaryPreference,
                  decoration: const InputDecoration(labelText: 'Diet'),
                  items: const [
                    DropdownMenuItem(value: DietaryPreference.none, child: Text('None')),
                    DropdownMenuItem(value: DietaryPreference.vegetarian, child: Text('Vegetarian')),
                    DropdownMenuItem(value: DietaryPreference.vegan, child: Text('Vegan')),
                    DropdownMenuItem(value: DietaryPreference.pescatarian, child: Text('Pescatarian')),
                    DropdownMenuItem(value: DietaryPreference.keto, child: Text('Keto')),
                    DropdownMenuItem(value: DietaryPreference.other, child: Text('Other')),
                  ],
                  onChanged: (v) => setState(() => _dietaryPreference = v ?? DietaryPreference.none),
                ),
                const SizedBox(height: 24),
                PrimaryButton(
                  label: 'Create account',
                  loadingLabel: 'Creating account...',
                  loading: _loading,
                  onPressed: _submit,
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Already have an account? ',
                        style: TextStyle(color: AppColors.inkSecondary, fontSize: 14)),
                    GestureDetector(
                      onTap: widget.onGoToLogin,
                      child: const Text(
                        'Log in',
                        style: TextStyle(color: AppColors.accent, fontSize: 14, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static const _spacer = SizedBox(height: 14);

  String? _requiredValidator(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
    bool obscureText = false,
    List<String>? autofillHints,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      autofillHints: autofillHints,
      decoration: InputDecoration(labelText: label),
      validator: validator,
    );
  }
}
