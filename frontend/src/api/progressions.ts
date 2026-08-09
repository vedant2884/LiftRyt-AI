import { api } from "../lib/api";
import type {
  ConfirmProgressionPayload,
  ExerciseProgression,
  UpdateProgressionPayload,
} from "../types/progression";

export async function fetchProgressions(): Promise<ExerciseProgression[]> {
  const res = await api.get<ExerciseProgression[]>("/exercises/progressions");
  return res.data;
}

export async function confirmProgression(
  payload: ConfirmProgressionPayload,
): Promise<ExerciseProgression> {
  const res = await api.post<ExerciseProgression>("/exercises/progressions/confirm", payload);
  return res.data;
}

export async function updateProgression(
  payload: UpdateProgressionPayload,
): Promise<ExerciseProgression> {
  const res = await api.patch<ExerciseProgression>("/exercises/progressions", payload);
  return res.data;
}
