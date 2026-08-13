import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../state/active_workout_state.dart';

/// Exercise picker for the active workout: recent -> favorites -> search,
/// deliberately not the full Library filter set — this needs to be fast
/// mid-workout. Equipment/movement/difficulty filters stay in the Library
/// (Phase 8). Mirrors `frontend/src/components/workout/ExercisePickerSheet.tsx`.
Future<ExerciseRef?> showExercisePickerSheet(BuildContext context) {
  return showModalBottomSheet<ExerciseRef>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const _ExercisePickerSheet(),
  );
}

class _ExercisePickerSheet extends ConsumerStatefulWidget {
  const _ExercisePickerSheet();

  @override
  ConsumerState<_ExercisePickerSheet> createState() => _ExercisePickerSheetState();
}

class _ExercisePickerSheetState extends ConsumerState<_ExercisePickerSheet> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  List<PickerExercise> _recent = [];
  List<PickerExercise> _favorites = [];
  List<PickerExercise> _searchResults = [];
  bool _loading = true;
  bool _searching = false;
  bool _creatingCustom = false;
  bool _savingCustom = false;

  final _nameController = TextEditingController();
  final _musclesController = TextEditingController();
  final _equipmentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _nameController.dispose();
    _musclesController.dispose();
    _equipmentController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    try {
      final recentRaw = await ref.read(workoutsApiProvider).fetchRecentExercises(limit: 8);
      final favoritesRaw = await ref.read(exercisesApiProvider).fetchFavorites();
      final recentKeys = recentRaw.map((r) => '${r.isCustom}:${r.id}').toSet();
      setState(() {
        _recent = recentRaw
            .map((r) => PickerExercise(
                id: r.id, isCustom: r.isCustom, name: r.name, primaryMuscles: r.primaryMuscles, equipment: r.equipment))
            .toList();
        _favorites =
            favoritesRaw.where((f) => !recentKeys.contains('${f.isCustom}:${f.id}')).toList();
        _loading = false;
      });
    } on ApiException {
      setState(() => _loading = false);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () => _runSearch(value));
    setState(() {});
  }

  Future<void> _runSearch(String query) async {
    if (query.trim().isEmpty) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final custom = await ref.read(exercisesApiProvider).searchCustomExercises(query);
      final normal = await ref.read(exercisesApiProvider).searchExercises(query);
      if (!mounted) return;
      setState(() {
        _searchResults = [...custom, ...normal];
        _searching = false;
      });
    } on ApiException {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _pick(PickerExercise row) {
    Navigator.of(context).pop(ExerciseRef(
      id: row.id,
      isCustom: row.isCustom,
      name: row.name,
      primaryMuscles: row.primaryMuscles,
      equipment: row.equipment,
    ));
  }

  Future<void> _createCustom() async {
    final muscles = _musclesController.text
        .split(',')
        .map((m) => m.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_'))
        .where((m) => m.isNotEmpty)
        .toList();
    if (_nameController.text.trim().isEmpty || muscles.isEmpty || _equipmentController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name, at least one muscle, and equipment are required.')),
      );
      return;
    }
    setState(() => _savingCustom = true);
    try {
      final created = await ref.read(exercisesApiProvider).createCustomExercise(
            name: _nameController.text.trim(),
            primaryMuscles: muscles,
            equipment: _equipmentController.text.trim(),
            movementType: 'compound',
            category: 'push',
            difficulty: 'beginner',
          );
      _pick(created);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        setState(() => _savingCustom = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim();
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('Add exercise',
                        style: TextStyle(color: AppColors.ink, fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                    color: AppColors.inkMuted,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                autofocus: false,
                onChanged: _onSearchChanged,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded, size: 20),
                  hintText: 'Search exercises...',
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                children: [
                  if (query.isNotEmpty) ...[
                    if (_searching) _loadingLine('Searching...'),
                    if (!_searching && _searchResults.isEmpty) _loadingLine('No matches.'),
                    for (final row in _searchResults) _ExerciseRow(row: row, onTap: () => _pick(row)),
                  ] else ...[
                    if (_loading) _loadingLine('Loading...'),
                    if (!_loading && _recent.isNotEmpty) ...[
                      _sectionLabel(Icons.history_rounded, 'Recent'),
                      for (final row in _recent) _ExerciseRow(row: row, onTap: () => _pick(row)),
                    ],
                    if (!_loading && _favorites.isNotEmpty) ...[
                      _sectionLabel(Icons.star_rounded, 'Favorites'),
                      for (final row in _favorites) _ExerciseRow(row: row, onTap: () => _pick(row)),
                    ],
                    if (!_loading && _recent.isEmpty && _favorites.isEmpty)
                      _loadingLine('Search above, or add your own exercise below.'),
                  ],
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.line))),
              child: SafeArea(
                top: false,
                child: _creatingCustom ? _customForm() : _addCustomButton(),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _addCustomButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () {
          _nameController.text = _searchController.text;
          setState(() => _creatingCustom = true);
        },
        icon: const Icon(Icons.add_rounded, size: 16),
        label: const Text('Add your own exercise'),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: AppColors.lineStrong),
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }

  Widget _customForm() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(controller: _nameController, decoration: const InputDecoration(hintText: 'Exercise name')),
        const SizedBox(height: 8),
        TextField(
          controller: _musclesController,
          decoration: const InputDecoration(hintText: 'Primary muscles (comma-separated)'),
        ),
        const SizedBox(height: 8),
        TextField(controller: _equipmentController, decoration: const InputDecoration(hintText: 'Equipment')),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: ElevatedButton(
                onPressed: _savingCustom ? null : _createCustom,
                child: Text(_savingCustom ? 'Adding...' : 'Add & use'),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () => setState(() => _creatingCustom = false),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _sectionLabel(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      child: Row(
        children: [
          Icon(icon, size: 12, color: AppColors.inkMuted),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(color: AppColors.inkMuted, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _loadingLine(String text) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Text(text, style: const TextStyle(color: AppColors.inkMuted, fontSize: 12)),
      );
}

class _ExerciseRow extends StatelessWidget {
  final PickerExercise row;
  final VoidCallback onTap;

  const _ExerciseRow({required this.row, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      if (row.primaryMuscles.isNotEmpty) row.primaryMuscles.first.replaceAll('_', ' '),
      row.equipment.replaceAll('_', ' '),
    ].join(' · ');

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(row.name, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.ink, fontSize: 14)),
            ),
            Text(subtitle,
                style: const TextStyle(color: AppColors.inkMuted, fontSize: 12), overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}
