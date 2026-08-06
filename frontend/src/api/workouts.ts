import { api } from "../lib/api";
import type {
  MuscleVolume,
  PersonalRecord,
  WeeklyVolume,
  WorkoutDetail,
  WorkoutSet,
  WorkoutSummary,
} from "../types/workout";

export interface WorkoutCreatePayload {
  name: string;
  performed_at?: string;
  notes?: string;
}

export interface WorkoutSetPayload {
  exercise_id: string;
  reps: number;
  weight_kg: number;
  rpe?: number;
  is_warmup?: boolean;
}

export async function createWorkout(payload: WorkoutCreatePayload): Promise<WorkoutSummary> {
  const res = await api.post<WorkoutSummary>("/workouts", payload);
  return res.data;
}

export async function fetchWorkouts(): Promise<WorkoutSummary[]> {
  const res = await api.get<WorkoutSummary[]>("/workouts");
  return res.data;
}

export async function fetchWorkout(id: string): Promise<WorkoutDetail> {
  const res = await api.get<WorkoutDetail>(`/workouts/${id}`);
  return res.data;
}

export async function deleteWorkout(id: string): Promise<void> {
  await api.delete(`/workouts/${id}`);
}

export async function addSet(workoutId: string, payload: WorkoutSetPayload): Promise<WorkoutSet> {
  const res = await api.post<WorkoutSet>(`/workouts/${workoutId}/sets`, payload);
  return res.data;
}

export async function deleteSet(workoutId: string, setId: string): Promise<void> {
  await api.delete(`/workouts/${workoutId}/sets/${setId}`);
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
