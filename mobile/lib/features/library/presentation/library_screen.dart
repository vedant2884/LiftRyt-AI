import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../data/library_api.dart';
import '../data/models.dart';
import 'exercise_detail_screen.dart';

String _humanize(String s) => s.replaceAll('_', ' ');

/// Mirrors the web Library's three views (search/favorites/custom) as tabs
/// instead of separate nav items — this needs to be fast to browse, not
/// exhaustive with every filter the web desktop layout has room for.
class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Library'),
          bottom: const TabBar(
            tabs: [Tab(text: 'Search'), Tab(text: 'Favorites'), Tab(text: 'Custom')],
          ),
        ),
        body: const SafeArea(
          child: TabBarView(
            children: [_SearchTab(), _FavoritesTab(), _CustomTab()],
          ),
        ),
      ),
    );
  }
}

class _SearchTab extends ConsumerStatefulWidget {
  const _SearchTab();

  @override
  ConsumerState<_SearchTab> createState() => _SearchTabState();
}

class _SearchTabState extends ConsumerState<_SearchTab> {
  final _controller = TextEditingController();
  List<LibraryExercise> _results = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    setState(() => _loading = true);
    try {
      final results = await ref.read(libraryApiProvider).searchExercises(q: q.isEmpty ? null : q);
      if (mounted) {
        setState(() {
          _results = results;
          _loading = false;
        });
      }
    } on ApiException {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _controller,
            onChanged: _search,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded, size: 20), hintText: 'Search exercises...'),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  children: [for (final ex in _results) _ExerciseTile(exercise: ex)],
                ),
        ),
      ],
    );
  }
}

class _FavoritesTab extends ConsumerStatefulWidget {
  const _FavoritesTab();

  @override
  ConsumerState<_FavoritesTab> createState() => _FavoritesTabState();
}

class _FavoritesTabState extends ConsumerState<_FavoritesTab> {
  List<FavoriteExercise> _favorites = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final favorites = await ref.read(libraryApiProvider).fetchFavorites();
      if (mounted) {
        setState(() {
          _favorites = favorites;
          _loading = false;
        });
      }
    } on ApiException {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_favorites.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('No favorites yet — star exercises from Search to see them here.',
              textAlign: TextAlign.center, style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      backgroundColor: AppColors.surface,
      child: ListView(
        children: [
          for (final f in _favorites)
            ListTile(
              title: Text(f.name, style: const TextStyle(color: AppColors.ink, fontSize: 14)),
              subtitle: Text(
                [if (f.primaryMuscles.isNotEmpty) _humanize(f.primaryMuscles.first), _humanize(f.equipment)].join(' · '),
                style: const TextStyle(color: AppColors.inkMuted, fontSize: 12),
              ),
              trailing: IconButton(
                icon: const Icon(Icons.star_rounded, color: AppColors.accent, size: 20),
                onPressed: () async {
                  await ref.read(libraryApiProvider).removeFavorite(f.id);
                  _load();
                },
              ),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => ExerciseDetailScreen(
                  exercise: LibraryExercise(
                    id: f.targetId,
                    isCustom: f.isCustom,
                    name: f.name,
                    primaryMuscles: f.primaryMuscles,
                    secondaryMuscles: const [],
                    equipment: f.equipment,
                    movementType: '',
                    category: '',
                    difficulty: '',
                  ),
                ),
              )),
            ),
        ],
      ),
    );
  }
}

class _CustomTab extends ConsumerStatefulWidget {
  const _CustomTab();

  @override
  ConsumerState<_CustomTab> createState() => _CustomTabState();
}

class _CustomTabState extends ConsumerState<_CustomTab> {
  List<LibraryExercise> _custom = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final custom = await ref.read(libraryApiProvider).fetchCustomExercises();
      if (mounted) {
        setState(() {
          _custom = custom;
          _loading = false;
        });
      }
    } on ApiException {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_custom.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('No custom exercises yet — add one from the workout logger\'s exercise picker.',
              textAlign: TextAlign.center, style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      backgroundColor: AppColors.surface,
      child: ListView(children: [for (final ex in _custom) _ExerciseTile(exercise: ex)]),
    );
  }
}

class _ExerciseTile extends ConsumerWidget {
  final LibraryExercise exercise;

  const _ExerciseTile({required this.exercise});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListTile(
      title: Text(exercise.name, style: const TextStyle(color: AppColors.ink, fontSize: 14)),
      subtitle: Text(
        [if (exercise.primaryMuscles.isNotEmpty) _humanize(exercise.primaryMuscles.first), _humanize(exercise.equipment)]
            .join(' · '),
        style: const TextStyle(color: AppColors.inkMuted, fontSize: 12),
      ),
      trailing: exercise.isCustom
          ? null
          : IconButton(
              icon: const Icon(Icons.star_outline_rounded, size: 20),
              color: AppColors.inkMuted,
              onPressed: () async {
                await ref.read(libraryApiProvider).addFavorite(exerciseId: exercise.id);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Added to favorites')));
                }
              },
            ),
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ExerciseDetailScreen(exercise: exercise))),
    );
  }
}
