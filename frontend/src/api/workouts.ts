import { api } from "../lib/api";
import type {
  ExerciseProgressionStats,
  MuscleVolume,
  PersonalRecord,
  RecentExercise,
  WeeklyVolume,
  WorkoutCreatePayload,
  WorkoutDetail,
  WorkoutOverview,
  WorkoutSet,
  WorkoutSetCreate,
  WorkoutSummary,
  WorkoutUpdatePayload,
} from "../types/workout";

export async function createWorkout(payload: WorkoutCreatePayload): Promise<WorkoutSummary> {
  const res = await api.post<WorkoutSummary>("/workouts", payload);
  return res.data;
}

export async function listWorkouts(): Promise<WorkoutSummary[]> {
  const res = await api.get<WorkoutSummary[]>("/workouts");
  return res.data;
}

export async function getWorkout(id: string): Promise<WorkoutDetail> {
  const res = await api.get<WorkoutDetail>(`/workouts/${id}`);
  return res.data;
}

export async function updateWorkout(id: string, payload: WorkoutUpdatePayload): Promise<WorkoutSummary> {
  const res = await api.patch<WorkoutSummary>(`/workouts/${id}`, payload);
  return res.data;
}

export async function deleteWorkout(id: string): Promise<void> {
  await api.delete(`/workouts/${id}`);
}

export async function addSet(workoutId: string, payload: WorkoutSetCreate): Promise<WorkoutSet> {
  const res = await api.post<WorkoutSet>(`/workouts/${workoutId}/sets`, payload);
  return res.data;
}

export async function deleteSet(workoutId: string, setId: string): Promise<void> {
  await api.delete(`/workouts/${workoutId}/sets/${setId}`);
}

export async function fetchRecentExercises(limit = 10): Promise<RecentExercise[]> {
  const res = await api.get<RecentExercise[]>("/workouts/recent-exercises", { params: { limit } });
  return res.data;
}

export async function fetchPersonalRecords(): Promise<PersonalRecord[]> {
  const res = await api.get<PersonalRecord[]>("/workouts/prs");
  return res.data;
}

export async function fetchWeeklyVolume(): Promise<WeeklyVolume[]> {
  const res = await api.get<WeeklyVolume[]>("/workouts/volume");
  return res.data;
}

export async function fetchMuscleVolume(): Promise<MuscleVolume[]> {
  const res = await api.get<MuscleVolume[]>("/workouts/volume/muscles");
  return res.data;
}

export async function fetchWorkoutOverview(): Promise<WorkoutOverview> {
  const res = await api.get<WorkoutOverview>("/workouts/analysis/overview");
  return res.data;
}

export async function fetchExerciseProgression(exerciseId: string): Promise<ExerciseProgressionStats> {
  const res = await api.get<ExerciseProgressionStats>(`/workouts/analysis/progression/${exerciseId}`);
  return res.data;
}
