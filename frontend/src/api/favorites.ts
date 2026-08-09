import { api } from "../lib/api";
import type { FavoriteExercise } from "../types/library";

export async function fetchFavorites(): Promise<FavoriteExercise[]> {
  const res = await api.get<FavoriteExercise[]>("/exercises/favorites");
  return res.data;
}

export async function addFavorite(
  payload: { exercise_id: string } | { custom_exercise_id: string },
): Promise<FavoriteExercise> {
  const res = await api.post<FavoriteExercise>("/exercises/favorites", payload);
  return res.data;
}

export async function removeFavorite(favoriteId: string): Promise<void> {
  await api.delete(`/exercises/favorites/${favoriteId}`);
}

export async function reorderFavorites(orderedIds: string[]): Promise<FavoriteExercise[]> {
  const res = await api.put<FavoriteExercise[]>("/exercises/favorites/reorder", {
    ordered_ids: orderedIds,
  });
  return res.data;
}
