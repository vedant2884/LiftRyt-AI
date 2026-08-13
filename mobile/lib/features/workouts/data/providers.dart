import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/providers.dart';
import 'exercises_api.dart';
import 'progressions_api.dart';
import 'workouts_api.dart';

final workoutsApiProvider = Provider((ref) => WorkoutsApi(ref.watch(dioProvider)));
final exercisesApiProvider = Provider((ref) => ExercisesApi(ref.watch(dioProvider)));
final progressionsApiProvider = Provider((ref) => ProgressionsApi(ref.watch(dioProvider)));
