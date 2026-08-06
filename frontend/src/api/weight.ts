import { api } from "../lib/api";
import type { WeightAnalytics, WeightLog } from "../types/weight";

export interface WeightLogPayload {
  weight_kg: number;
  logged_at?: string;
  note?: string;
}

export async function logWeight(payload: WeightLogPayload): Promise<WeightLog> {
  const res = await api.post<WeightLog>("/weight-logs", payload);
  return res.data;
}

export async function fetchWeightLogs(): Promise<WeightLog[]> {
  const res = await api.get<WeightLog[]>("/weight-logs");
  return res.data;
}

export async function fetchWeightAnalytics(): Promise<WeightAnalytics> {
  const res = await api.get<WeightAnalytics>("/weight-logs/analytics");
  return res.data;
}

export async function deleteWeightLog(id: string): Promise<void> {
  await api.delete(`/weight-logs/${id}`);
}
