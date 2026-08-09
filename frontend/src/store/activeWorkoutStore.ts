import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorkoutDetail, WorkoutSet } from "../types/workout";

export interface DraftSet {
  localId: string;
  // Strings, not numbers — lets the input be legitimately empty/partial
  // while the user is mid-edit instead of coercing to 0.
  weight: string;
  reps: string;
  completed: boolean;
  serverId?: string;
  saving?: boolean;
  saveError?: string;
  isPr?: boolean;
  // Set together whenever a completed set comes back as a PR with a live
  // suggestion (progression enabled for this exercise) — drives the inline
  // "Increase next weight?" prompt. Cleared on confirm or dismiss, never
  // acted on automatically.
  suggestedIncrementKg?: number | null;
  showPrPrompt?: boolean;
}

export interface DraftExercise {
  localId: string;
  exerciseId?: string;
  customExerciseId?: string;
  name: string;
  primaryMuscles: string[];
  equipment: string;
  sets: DraftSet[];
}

interface ExerciseRef {
  id: string;
  isCustom: boolean;
  name: string;
  primaryMuscles: string[];
  equipment: string;
}

interface ActiveWorkoutState {
  workoutId: string | null;
  name: string;
  startedAt: string | null;
  exercises: DraftExercise[];
  restEndsAt: string | null;
  restDurationSeconds: number;

  isActive: () => boolean;
  startWorkout: (name: string) => void;
  setWorkoutId: (id: string) => void;
  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  setRestDuration: (seconds: number) => void;
  addExercise: (exercise: ExerciseRef) => string;
  removeExercise: (exerciseLocalId: string) => void;
  moveExercise: (exerciseLocalId: string, direction: "up" | "down") => void;
  addSetDraft: (exerciseLocalId: string, initial?: Partial<DraftSet>) => void;
  duplicateSet: (exerciseLocalId: string, setLocalId: string) => void;
  updateSetDraft: (exerciseLocalId: string, setLocalId: string, patch: Partial<DraftSet>) => void;
  removeSetDraft: (exerciseLocalId: string, setLocalId: string) => void;
  markSetSynced: (exerciseLocalId: string, setLocalId: string, server: WorkoutSet) => void;
  dismissPrPrompt: (exerciseLocalId: string, setLocalId: string) => void;
  resetStaleSaving: () => void;
  prefillFromWorkout: (detail: WorkoutDetail) => void;
  clearExercises: () => void;
  discard: () => void;
}

function localId(): string {
  return crypto.randomUUID();
}

const EMPTY_STATE = {
  workoutId: null as string | null,
  name: "",
  startedAt: null as string | null,
  exercises: [] as DraftExercise[],
  restEndsAt: null as string | null,
  restDurationSeconds: 90,
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      ...EMPTY_STATE,

      isActive: () => get().startedAt !== null,

      startWorkout: (name) => {
        set({ ...EMPTY_STATE, name, startedAt: new Date().toISOString() });
      },

      setWorkoutId: (id) => set({ workoutId: id }),

      startRestTimer: (seconds) => {
        set({
          restEndsAt: new Date(Date.now() + seconds * 1000).toISOString(),
          restDurationSeconds: seconds,
        });
      },
      stopRestTimer: () => set({ restEndsAt: null }),
      setRestDuration: (seconds) => set({ restDurationSeconds: seconds }),

      addExercise: (exercise) => {
        const id = localId();
        set((state) => ({
          exercises: [
            ...state.exercises,
            {
              localId: id,
              exerciseId: exercise.isCustom ? undefined : exercise.id,
              customExerciseId: exercise.isCustom ? exercise.id : undefined,
              name: exercise.name,
              primaryMuscles: exercise.primaryMuscles,
              equipment: exercise.equipment,
              // Seeded with one empty set so there's immediately something
              // to fill in — matches Complete Set's own auto-append below,
              // so the user is never stuck tapping "Add set" just to begin.
              sets: [{ localId: localId(), weight: "", reps: "", completed: false }],
            },
          ],
        }));
        return id;
      },

      removeExercise: (exerciseLocalId) => {
        set((state) => ({
          exercises: state.exercises.filter((e) => e.localId !== exerciseLocalId),
        }));
      },

      moveExercise: (exerciseLocalId, direction) => {
        set((state) => {
          const index = state.exercises.findIndex((e) => e.localId === exerciseLocalId);
          const swapWith = direction === "up" ? index - 1 : index + 1;
          if (index === -1 || swapWith < 0 || swapWith >= state.exercises.length) return state;
          const next = [...state.exercises];
          [next[index], next[swapWith]] = [next[swapWith], next[index]];
          return { exercises: next };
        });
      },

      addSetDraft: (exerciseLocalId, initial) => {
        set((state) => ({
          exercises: state.exercises.map((e) =>
            e.localId === exerciseLocalId
              ? {
                  ...e,
                  sets: [
                    ...e.sets,
                    { localId: localId(), weight: "", reps: "", completed: false, ...initial },
                  ],
                }
              : e,
          ),
        }));
      },

      duplicateSet: (exerciseLocalId, setLocalId) => {
        set((state) => ({
          exercises: state.exercises.map((e) => {
            if (e.localId !== exerciseLocalId) return e;
            const source = e.sets.find((s) => s.localId === setLocalId);
            if (!source) return e;
            return {
              ...e,
              sets: [
                ...e.sets,
                { localId: localId(), weight: source.weight, reps: source.reps, completed: false },
              ],
            };
          }),
        }));
      },

      updateSetDraft: (exerciseLocalId, setLocalId, patch) => {
        set((state) => ({
          exercises: state.exercises.map((e) =>
            e.localId === exerciseLocalId
              ? { ...e, sets: e.sets.map((s) => (s.localId === setLocalId ? { ...s, ...patch } : s)) }
              : e,
          ),
        }));
      },

      removeSetDraft: (exerciseLocalId, setLocalId) => {
        set((state) => ({
          exercises: state.exercises.map((e) =>
            e.localId === exerciseLocalId
              ? { ...e, sets: e.sets.filter((s) => s.localId !== setLocalId) }
              : e,
          ),
        }));
      },

      markSetSynced: (exerciseLocalId, setLocalId, server) => {
        set((state) => ({
          exercises: state.exercises.map((e) =>
            e.localId === exerciseLocalId
              ? {
                  ...e,
                  sets: e.sets.map((s) =>
                    s.localId === setLocalId
                      ? {
                          ...s,
                          completed: true,
                          saving: false,
                          saveError: undefined,
                          serverId: server.id,
                          isPr: server.is_pr,
                          suggestedIncrementKg: server.suggested_increment_kg,
                          showPrPrompt: server.is_pr && server.suggested_increment_kg != null,
                          weight: String(server.weight_kg),
                          reps: String(server.reps),
                        }
                      : s,
                  ),
                }
              : e,
          ),
        }));
      },

      dismissPrPrompt: (exerciseLocalId, setLocalId) => {
        set((state) => ({
          exercises: state.exercises.map((e) =>
            e.localId === exerciseLocalId
              ? {
                  ...e,
                  sets: e.sets.map((s) =>
                    s.localId === setLocalId ? { ...s, showPrPrompt: false } : s,
                  ),
                }
              : e,
          ),
        }));
      },

      // A page reload mid-save leaves a persisted `saving: true` behind
      // with no request actually in flight anymore — called once when the
      // active workout screen mounts so those rows show a retry affordance
      // instead of spinning forever.
      resetStaleSaving: () => {
        set((state) => ({
          exercises: state.exercises.map((e) => ({
            ...e,
            sets: e.sets.map((s) => (s.saving ? { ...s, saving: false } : s)),
          })),
        }));
      },

      prefillFromWorkout: (detail) => {
        const byExercise = new Map<string, DraftExercise>();
        for (const s of detail.sets) {
          const key = s.is_custom ? `custom:${s.custom_exercise_id}` : `real:${s.exercise_id}`;
          let exercise = byExercise.get(key);
          if (!exercise) {
            exercise = {
              localId: localId(),
              exerciseId: s.is_custom ? undefined : (s.exercise_id ?? undefined),
              customExerciseId: s.is_custom ? (s.custom_exercise_id ?? undefined) : undefined,
              name: s.exercise_name,
              primaryMuscles: [],
              equipment: "",
              sets: [],
            };
            byExercise.set(key, exercise);
          }
          exercise.sets.push({
            localId: localId(),
            weight: String(s.weight_kg),
            reps: String(s.reps),
            completed: false,
          });
        }
        set({ exercises: Array.from(byExercise.values()) });
      },

      // Lets the user back out of an unwanted auto-prefill without losing
      // the workout name/start time — "a reasonable way to skip
      // previous-workout prefill" applied after the fact rather than as a
      // blocking prompt before they've even seen what would be prefilled.
      clearExercises: () => set({ exercises: [] }),

      discard: () => set({ ...EMPTY_STATE }),
    }),
    { name: "liftryt-active-workout" },
  ),
);
