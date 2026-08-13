import 'dart:convert';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/storage/providers.dart';
import '../data/models.dart';

const _storageKey = 'liftryt_active_workout';

String _newLocalId() {
  final rand = Random.secure();
  return List.generate(16, (_) => rand.nextInt(16).toRadixString(16)).join();
}

class DraftSet {
  final String localId;
  final String weight;
  final String reps;
  final bool completed;
  final String? serverId;
  final bool saving;
  final String? saveError;
  final bool isPr;
  final double? suggestedIncrementKg;
  final bool showPrPrompt;

  const DraftSet({
    required this.localId,
    this.weight = '',
    this.reps = '',
    this.completed = false,
    this.serverId,
    this.saving = false,
    this.saveError,
    this.isPr = false,
    this.suggestedIncrementKg,
    this.showPrPrompt = false,
  });

  DraftSet copyWith({
    String? weight,
    String? reps,
    bool? completed,
    String? serverId,
    bool? saving,
    Object? saveError = _sentinel,
    bool? isPr,
    double? suggestedIncrementKg,
    bool? showPrPrompt,
  }) {
    return DraftSet(
      localId: localId,
      weight: weight ?? this.weight,
      reps: reps ?? this.reps,
      completed: completed ?? this.completed,
      serverId: serverId ?? this.serverId,
      saving: saving ?? this.saving,
      saveError: identical(saveError, _sentinel) ? this.saveError : saveError as String?,
      isPr: isPr ?? this.isPr,
      suggestedIncrementKg: suggestedIncrementKg ?? this.suggestedIncrementKg,
      showPrPrompt: showPrPrompt ?? this.showPrPrompt,
    );
  }

  Map<String, dynamic> toJson() => {
        'localId': localId,
        'weight': weight,
        'reps': reps,
        'completed': completed,
        'serverId': serverId,
        'isPr': isPr,
        'suggestedIncrementKg': suggestedIncrementKg,
        'showPrPrompt': showPrPrompt,
      };

  factory DraftSet.fromJson(Map<String, dynamic> json) => DraftSet(
        localId: json['localId'] as String,
        weight: json['weight'] as String? ?? '',
        reps: json['reps'] as String? ?? '',
        completed: json['completed'] as bool? ?? false,
        serverId: json['serverId'] as String?,
        isPr: json['isPr'] as bool? ?? false,
        suggestedIncrementKg: (json['suggestedIncrementKg'] as num?)?.toDouble(),
        showPrPrompt: json['showPrPrompt'] as bool? ?? false,
      );
}

const _sentinel = Object();

class DraftExercise {
  final String localId;
  final String? exerciseId;
  final String? customExerciseId;
  final String name;
  final List<String> primaryMuscles;
  final String equipment;
  final List<DraftSet> sets;

  const DraftExercise({
    required this.localId,
    this.exerciseId,
    this.customExerciseId,
    required this.name,
    this.primaryMuscles = const [],
    this.equipment = '',
    this.sets = const [],
  });

  DraftExercise copyWith({List<DraftSet>? sets}) => DraftExercise(
        localId: localId,
        exerciseId: exerciseId,
        customExerciseId: customExerciseId,
        name: name,
        primaryMuscles: primaryMuscles,
        equipment: equipment,
        sets: sets ?? this.sets,
      );

  Map<String, dynamic> toJson() => {
        'localId': localId,
        'exerciseId': exerciseId,
        'customExerciseId': customExerciseId,
        'name': name,
        'primaryMuscles': primaryMuscles,
        'equipment': equipment,
        'sets': sets.map((s) => s.toJson()).toList(),
      };

  factory DraftExercise.fromJson(Map<String, dynamic> json) => DraftExercise(
        localId: json['localId'] as String,
        exerciseId: json['exerciseId'] as String?,
        customExerciseId: json['customExerciseId'] as String?,
        name: json['name'] as String,
        primaryMuscles: (json['primaryMuscles'] as List<dynamic>? ?? []).cast<String>(),
        equipment: json['equipment'] as String? ?? '',
        sets: (json['sets'] as List<dynamic>? ?? [])
            .map((s) => DraftSet.fromJson(s as Map<String, dynamic>))
            .toList(),
      );
}

class ExerciseRef {
  final String id;
  final bool isCustom;
  final String name;
  final List<String> primaryMuscles;
  final String equipment;

  const ExerciseRef({
    required this.id,
    required this.isCustom,
    required this.name,
    required this.primaryMuscles,
    required this.equipment,
  });
}

class ActiveWorkoutState {
  final String? workoutId;
  final String name;
  final DateTime? startedAt;
  final List<DraftExercise> exercises;
  final DateTime? restEndsAt;
  final int restDurationSeconds;

  const ActiveWorkoutState({
    this.workoutId,
    this.name = '',
    this.startedAt,
    this.exercises = const [],
    this.restEndsAt,
    this.restDurationSeconds = 90,
  });

  bool get isActive => startedAt != null;

  ActiveWorkoutState copyWith({
    Object? workoutId = _sentinel,
    String? name,
    Object? startedAt = _sentinel,
    List<DraftExercise>? exercises,
    Object? restEndsAt = _sentinel,
    int? restDurationSeconds,
  }) {
    return ActiveWorkoutState(
      workoutId: identical(workoutId, _sentinel) ? this.workoutId : workoutId as String?,
      name: name ?? this.name,
      startedAt: identical(startedAt, _sentinel) ? this.startedAt : startedAt as DateTime?,
      exercises: exercises ?? this.exercises,
      restEndsAt: identical(restEndsAt, _sentinel) ? this.restEndsAt : restEndsAt as DateTime?,
      restDurationSeconds: restDurationSeconds ?? this.restDurationSeconds,
    );
  }

  Map<String, dynamic> toJson() => {
        'workoutId': workoutId,
        'name': name,
        'startedAt': startedAt?.toIso8601String(),
        'exercises': exercises.map((e) => e.toJson()).toList(),
        'restEndsAt': restEndsAt?.toIso8601String(),
        'restDurationSeconds': restDurationSeconds,
      };

  factory ActiveWorkoutState.fromJson(Map<String, dynamic> json) => ActiveWorkoutState(
        workoutId: json['workoutId'] as String?,
        name: json['name'] as String? ?? '',
        startedAt: json['startedAt'] == null ? null : DateTime.tryParse(json['startedAt'] as String),
        exercises: (json['exercises'] as List<dynamic>? ?? [])
            .map((e) => DraftExercise.fromJson(e as Map<String, dynamic>))
            .toList(),
        restEndsAt: json['restEndsAt'] == null ? null : DateTime.tryParse(json['restEndsAt'] as String),
        restDurationSeconds: json['restDurationSeconds'] as int? ?? 90,
      );
}

/// Local-first active-workout draft — mirrors
/// `frontend/src/store/activeWorkoutStore.ts` method-for-method, persisted
/// to disk (via SharedPreferences) on every mutation so a killed app or a
/// failed save never loses logged sets, only the current draft state. The
/// backend Workout row itself is created lazily on the first completed set
/// (see `ensureWorkoutId` in active_workout_screen.dart), same as web.
class ActiveWorkoutController extends Notifier<ActiveWorkoutState> {
  late final SharedPreferences _prefs;

  @override
  ActiveWorkoutState build() {
    _prefs = ref.read(sharedPreferencesProvider);
    final raw = _prefs.getString(_storageKey);
    if (raw == null) return const ActiveWorkoutState();
    try {
      return ActiveWorkoutState.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const ActiveWorkoutState();
    }
  }

  void _persist() {
    _prefs.setString(_storageKey, jsonEncode(state.toJson()));
  }

  void _set(ActiveWorkoutState next) {
    state = next;
    _persist();
  }

  void startWorkout(String name) {
    _set(ActiveWorkoutState(name: name, startedAt: DateTime.now()));
  }

  void setWorkoutId(String id) => _set(state.copyWith(workoutId: id));

  void startRestTimer(int seconds) {
    _set(state.copyWith(
      restEndsAt: DateTime.now().add(Duration(seconds: seconds)),
      restDurationSeconds: seconds,
    ));
  }

  void stopRestTimer() => _set(state.copyWith(restEndsAt: null));

  void setRestDuration(int seconds) => _set(state.copyWith(restDurationSeconds: seconds));

  String addExercise(ExerciseRef exercise) {
    final id = _newLocalId();
    final newExercise = DraftExercise(
      localId: id,
      exerciseId: exercise.isCustom ? null : exercise.id,
      customExerciseId: exercise.isCustom ? exercise.id : null,
      name: exercise.name,
      primaryMuscles: exercise.primaryMuscles,
      equipment: exercise.equipment,
      sets: [DraftSet(localId: _newLocalId())],
    );
    _set(state.copyWith(exercises: [...state.exercises, newExercise]));
    return id;
  }

  void removeExercise(String exerciseLocalId) {
    _set(state.copyWith(
      exercises: state.exercises.where((e) => e.localId != exerciseLocalId).toList(),
    ));
  }

  void moveExercise(String exerciseLocalId, {required bool up}) {
    final list = [...state.exercises];
    final index = list.indexWhere((e) => e.localId == exerciseLocalId);
    final swapWith = up ? index - 1 : index + 1;
    if (index == -1 || swapWith < 0 || swapWith >= list.length) return;
    final tmp = list[index];
    list[index] = list[swapWith];
    list[swapWith] = tmp;
    _set(state.copyWith(exercises: list));
  }

  void addSetDraft(String exerciseLocalId, {String weight = '', String reps = ''}) {
    _set(state.copyWith(
      exercises: state.exercises.map((e) {
        if (e.localId != exerciseLocalId) return e;
        return e.copyWith(sets: [...e.sets, DraftSet(localId: _newLocalId(), weight: weight, reps: reps)]);
      }).toList(),
    ));
  }

  void duplicateSet(String exerciseLocalId, String setLocalId) {
    _set(state.copyWith(
      exercises: state.exercises.map((e) {
        if (e.localId != exerciseLocalId) return e;
        final source = e.sets.where((s) => s.localId == setLocalId).firstOrNull;
        if (source == null) return e;
        return e.copyWith(
          sets: [...e.sets, DraftSet(localId: _newLocalId(), weight: source.weight, reps: source.reps)],
        );
      }).toList(),
    ));
  }

  void updateSetDraft(
    String exerciseLocalId,
    String setLocalId, {
    String? weight,
    String? reps,
    bool? saving,
    Object? saveError = _sentinel,
  }) {
    _set(state.copyWith(
      exercises: state.exercises.map((e) {
        if (e.localId != exerciseLocalId) return e;
        return e.copyWith(
          sets: e.sets.map((s) {
            if (s.localId != setLocalId) return s;
            return s.copyWith(weight: weight, reps: reps, saving: saving, saveError: saveError);
          }).toList(),
        );
      }).toList(),
    ));
  }

  void removeSetDraft(String exerciseLocalId, String setLocalId) {
    _set(state.copyWith(
      exercises: state.exercises.map((e) {
        if (e.localId != exerciseLocalId) return e;
        return e.copyWith(sets: e.sets.where((s) => s.localId != setLocalId).toList());
      }).toList(),
    ));
  }

  void markSetSynced(String exerciseLocalId, String setLocalId, WorkoutSet server) {
    _set(state.copyWith(
      exercises: state.exercises.map((e) {
        if (e.localId != exerciseLocalId) return e;
        return e.copyWith(
          sets: e.sets.map((s) {
            if (s.localId != setLocalId) return s;
            return s.copyWith(
              completed: true,
              saving: false,
              saveError: null,
              serverId: server.id,
              isPr: server.isPr,
              suggestedIncrementKg: server.suggestedIncrementKg,
              showPrPrompt: server.isPr && server.suggestedIncrementKg != null,
              weight: server.weightKg.toString(),
              reps: server.reps.toString(),
            );
          }).toList(),
        );
      }).toList(),
    ));
  }

  void dismissPrPrompt(String exerciseLocalId, String setLocalId) {
    _set(state.copyWith(
      exercises: state.exercises.map((e) {
        if (e.localId != exerciseLocalId) return e;
        return e.copyWith(
          sets: e.sets.map((s) => s.localId == setLocalId ? s.copyWith(showPrPrompt: false) : s).toList(),
        );
      }).toList(),
    ));
  }

  /// A killed app mid-save leaves a persisted `saving: true` behind with no
  /// request actually in flight — called once when the active workout
  /// screen mounts so those rows show a retry affordance instead of
  /// spinning forever.
  void resetStaleSaving() {
    _set(state.copyWith(
      exercises: state.exercises
          .map((e) => e.copyWith(sets: e.sets.map((s) => s.saving ? s.copyWith(saving: false) : s).toList()))
          .toList(),
    ));
  }

  void prefillFromWorkout(WorkoutDetail detail) {
    final byExercise = <String, DraftExercise>{};
    for (final s in detail.sets) {
      final key = s.isCustom ? 'custom:${s.customExerciseId}' : 'real:${s.exerciseId}';
      final existing = byExercise[key];
      final exercise = existing ??
          DraftExercise(
            localId: _newLocalId(),
            exerciseId: s.isCustom ? null : s.exerciseId,
            customExerciseId: s.isCustom ? s.customExerciseId : null,
            name: s.exerciseName,
            sets: const [],
          );
      byExercise[key] = exercise.copyWith(sets: [
        ...exercise.sets,
        DraftSet(localId: _newLocalId(), weight: s.weightKg.toString(), reps: s.reps.toString()),
      ]);
    }
    _set(state.copyWith(exercises: byExercise.values.toList()));
  }

  void clearExercises() => _set(state.copyWith(exercises: []));

  void discard() {
    _prefs.remove(_storageKey);
    state = const ActiveWorkoutState();
  }
}

final activeWorkoutProvider = NotifierProvider<ActiveWorkoutController, ActiveWorkoutState>(
  ActiveWorkoutController.new,
);
