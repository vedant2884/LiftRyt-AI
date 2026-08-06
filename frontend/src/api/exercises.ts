import { api } from "../lib/api";
import type { ExerciseListResponse } from "../types/exercise";

export interface ExerciseFilters {
  q?: string;
  muscle?: string;
  equipment?: string;
  category?: string;
  movement_type?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
}

export async function fetchExercises(filters: ExerciseFilters): Promise<ExerciseListResponse> {
  const res = await api.get<ExerciseListResponse>("/exercises", { params: filters });
  return res.data;
}

export async function fetchMuscleOptions(): Promise<string[]> {
  const res = await api.get<string[]>("/exercises/muscles");
  return res.data;
}

export async function fetchEquipmentOptions(): Promise<string[]> {
  const res = await api.get<string[]>("/exercises/equipment");
  return res.data;
}
