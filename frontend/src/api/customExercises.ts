import { api } from "../lib/api";
import type { CustomExercise, CustomExercisePayload } from "../types/library";

export interface CustomExerciseFilters {
  q?: string;
  category?: string;
  difficulty?: string;
}

export async function fetchCustomExercises(filters: CustomExerciseFilters = {}): Promise<CustomExercise[]> {
  const res = await api.get<CustomExercise[]>("/exercises/custom", { params: filters });
  return res.data;
}

export async function createCustomExercise(payload: CustomExercisePayload): Promise<CustomExercise> {
  const res = await api.post<CustomExercise>("/exercises/custom", payload);
  return res.data;
}

export async function updateCustomExercise(
  id: string,
  payload: Partial<CustomExercisePayload>,
): Promise<CustomExercise> {
  const res = await api.patch<CustomExercise>(`/exercises/custom/${id}`, payload);
  return res.data;
}

export async function deleteCustomExercise(id: string): Promise<void> {
  await api.delete(`/exercises/custom/${id}`);
}
