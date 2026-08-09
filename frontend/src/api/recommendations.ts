import { api } from "../lib/api";
import type { Recommendations } from "../types/library";

export async function fetchRecommendations(): Promise<Recommendations> {
  const res = await api.get<Recommendations>("/recommendations");
  return res.data;
}
