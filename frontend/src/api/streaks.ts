import { api } from "../lib/api";
import type { Streaks } from "../types/streaks";

export async function fetchStreaks(): Promise<Streaks> {
  const res = await api.get<Streaks>("/streaks");
  return res.data;
}
