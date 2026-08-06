import { api } from "../lib/api";
import type { Exercise, ExerciseListResponse } from "../types/exercise";

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

// RAG-based search (pgvector cosine similarity over sentence-transformer
// embeddings) — finds exercises by meaning rather than requiring the query
// to literally appear in the name/description, unlike fetchExercises' q param.
export async function fetchExercisesSemantic(query: string, limit = 24): Promise<Exercise[]> {
  const res = await api.get<Exercise[]>("/exercises/search/semantic", {
    params: { q: query, limit },
  });
  return res.data;
}
