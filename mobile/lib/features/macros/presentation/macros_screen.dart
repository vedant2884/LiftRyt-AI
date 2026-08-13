import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../data/macros_api.dart';
import '../data/models.dart';

/// Mirrors `frontend/src/pages/MacroCalculatorPage.tsx` — same backend
/// calculation engine, never a second BMR/TDEE formula.
class MacrosScreen extends ConsumerStatefulWidget {
  const MacrosScreen({super.key});

  @override
  ConsumerState<MacrosScreen> createState() => _MacrosScreenState();
}

class _MacrosScreenState extends ConsumerState<MacrosScreen> {
  MacroTarget? _active;
  bool _loading = true;
  bool _calculating = false;
  String _goal = 'maintain';
  final _weightController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _weightController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final active = await ref.read(macrosApiProvider).fetchActive();
      if (mounted) {
        setState(() {
          _active = active;
          _loading = false;
        });
      }
    } on ApiException {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _calculate() async {
    setState(() => _calculating = true);
    try {
      final weight = double.tryParse(_weightController.text);
      final result = await ref.read(macrosApiProvider).calculate(goal: _goal, weightKg: weight);
      if (mounted) setState(() => _active = result);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _calculating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Macros')),
      body: SafeArea(child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Calculate targets', style: TextStyle(color: AppColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                        initialValue: _goal,
                        decoration: const InputDecoration(isDense: true, labelText: 'Goal'),
                        items: const [
                          DropdownMenuItem(value: 'cut', child: Text('Cut')),
                          DropdownMenuItem(value: 'maintain', child: Text('Maintain')),
                          DropdownMenuItem(value: 'bulk', child: Text('Bulk')),
                        ],
                        onChanged: (v) => setState(() => _goal = v ?? 'maintain'),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _weightController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          isDense: true,
                          labelText: 'Weight (kg, optional — uses your latest logged weight)',
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _calculating ? null : _calculate,
                          child: Text(_calculating ? 'Calculating...' : 'Calculate'),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_active != null) ...[
                  const SizedBox(height: 16),
                  const Text('Your targets', style: TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 10),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${_active!.targetCalories.round()} kcal/day',
                            style: const TextStyle(color: AppColors.accent, fontSize: 22, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _macroTile('Protein', _active!.targetProteinG),
                            _macroTile('Carbs', _active!.targetCarbsG),
                            _macroTile('Fat', _active!.targetFatG),
                          ],
                        ),
                        const Divider(color: AppColors.line, height: 24),
                        Text('BMR: ${_active!.bmr.round()} · TDEE: ${_active!.tdee.round()}',
                            style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
      ),
    );
  }

  Widget _macroTile(String label, double grams) {
    return Column(
      children: [
        Text('${grams.round()}g', style: const TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: AppColors.inkMuted, fontSize: 11)),
      ],
    );
  }
}
