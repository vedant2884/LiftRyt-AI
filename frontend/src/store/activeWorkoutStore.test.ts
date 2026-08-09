import { beforeEach, describe, expect, it } from "vitest";
import { useActiveWorkoutStore } from "./activeWorkoutStore";

const EXERCISE = {
  id: "ex-1",
  isCustom: false,
  name: "Bench Press",
  primaryMuscles: ["chest"],
  equipment: "barbell",
};

beforeEach(() => {
  useActiveWorkoutStore.getState().discard();
});

describe("activeWorkoutStore", () => {
  it("starts inactive and becomes active once a workout is started", () => {
    expect(useActiveWorkoutStore.getState().isActive()).toBe(false);
    useActiveWorkoutStore.getState().startWorkout("Push Day");
    expect(useActiveWorkoutStore.getState().isActive()).toBe(true);
    expect(useActiveWorkoutStore.getState().name).toBe("Push Day");
  });

  it("seeds a new exercise with exactly one empty draft set", () => {
    useActiveWorkoutStore.getState().startWorkout("Push Day");
    useActiveWorkoutStore.getState().addExercise(EXERCISE);

    const exercise = useActiveWorkoutStore.getState().exercises[0];
    expect(exercise.sets).toHaveLength(1);
    expect(exercise.sets[0].completed).toBe(false);
  });

  it("duplicateSet clones weight/reps into a new, uncompleted draft row", () => {
    useActiveWorkoutStore.getState().startWorkout("Push Day");
    const exerciseId = useActiveWorkoutStore.getState().addExercise(EXERCISE);
    const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;
    useActiveWorkoutStore
      .getState()
      .updateSetDraft(exerciseId, setId, { weight: "80", reps: "8", completed: true });

    useActiveWorkoutStore.getState().duplicateSet(exerciseId, setId);

    const sets = useActiveWorkoutStore.getState().exercises[0].sets;
    expect(sets).toHaveLength(2);
    expect(sets[1]).toMatchObject({ weight: "80", reps: "8", completed: false });
    expect(sets[1].localId).not.toBe(setId);
  });

  it("moveExercise swaps order and respects the array boundaries", () => {
    useActiveWorkoutStore.getState().startWorkout("Push Day");
    const firstId = useActiveWorkoutStore.getState().addExercise(EXERCISE);
    const secondId = useActiveWorkoutStore.getState().addExercise({ ...EXERCISE, id: "ex-2", name: "Incline Press" });

    useActiveWorkoutStore.getState().moveExercise(secondId, "up");
    expect(useActiveWorkoutStore.getState().exercises.map((e) => e.localId)).toEqual([secondId, firstId]);

    // Already first — moving up again is a no-op, not an out-of-bounds swap.
    useActiveWorkoutStore.getState().moveExercise(secondId, "up");
    expect(useActiveWorkoutStore.getState().exercises.map((e) => e.localId)).toEqual([secondId, firstId]);
  });

  it("markSetSynced marks the set completed and records the server id / PR flag", () => {
    useActiveWorkoutStore.getState().startWorkout("Push Day");
    const exerciseId = useActiveWorkoutStore.getState().addExercise(EXERCISE);
    const setId = useActiveWorkoutStore.getState().exercises[0].sets[0].localId;

    useActiveWorkoutStore.getState().markSetSynced(exerciseId, setId, {
      id: "server-set-1",
      exercise_id: "ex-1",
      custom_exercise_id: null,
      is_custom: false,
      exercise_name: "Bench Press",
      set_number: 1,
      reps: 8,
      weight_kg: 80,
      rpe: null,
      is_warmup: false,
      is_pr: true,
      suggested_increment_kg: 2.5,
      created_at: new Date().toISOString(),
    });

    const set = useActiveWorkoutStore.getState().exercises[0].sets[0];
    expect(set.completed).toBe(true);
    expect(set.serverId).toBe("server-set-1");
    expect(set.isPr).toBe(true);
  });

  it("prefillFromWorkout groups sets by exercise and preserves per-exercise set order", () => {
    useActiveWorkoutStore.getState().startWorkout("Push Day");
    useActiveWorkoutStore.getState().prefillFromWorkout({
      id: "w1",
      name: "Push Day",
      performed_at: new Date().toISOString(),
      notes: null,
      duration_seconds: 2400,
      sets: [
        {
          id: "s1",
          exercise_id: "ex-1",
          custom_exercise_id: null,
          is_custom: false,
          exercise_name: "Bench Press",
          set_number: 1,
          reps: 8,
          weight_kg: 80,
          rpe: null,
          is_warmup: false,
          is_pr: false,
          suggested_increment_kg: null,
          created_at: new Date().toISOString(),
        },
        {
          id: "s2",
          exercise_id: "ex-1",
          custom_exercise_id: null,
          is_custom: false,
          exercise_name: "Bench Press",
          set_number: 2,
          reps: 6,
          weight_kg: 90,
          rpe: null,
          is_warmup: false,
          is_pr: false,
          suggested_increment_kg: null,
          created_at: new Date().toISOString(),
        },
      ],
    });

    const exercises = useActiveWorkoutStore.getState().exercises;
    expect(exercises).toHaveLength(1);
    expect(exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([
      ["80", "8"],
      ["90", "6"],
    ]);
    // Prefilled sets are starting points to edit and re-confirm, not
    // already-done sets — never pre-marked completed.
    expect(exercises[0].sets.every((s) => !s.completed)).toBe(true);
  });

  it("discard resets to a fully blank, inactive state", () => {
    useActiveWorkoutStore.getState().startWorkout("Push Day");
    useActiveWorkoutStore.getState().addExercise(EXERCISE);

    useActiveWorkoutStore.getState().discard();

    expect(useActiveWorkoutStore.getState().isActive()).toBe(false);
    expect(useActiveWorkoutStore.getState().exercises).toHaveLength(0);
    expect(useActiveWorkoutStore.getState().workoutId).toBeNull();
  });
});
