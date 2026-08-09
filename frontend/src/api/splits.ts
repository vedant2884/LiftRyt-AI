import { api } from "../lib/api";
import type { SplitPlan, SplitSummary, TrainingGoal } from "../types/split";
import type { ExperienceLevel } from "../types/user";

export async function generateSplit(
  daysPerWeek: number,
  experienceLevel: ExperienceLevel,
  goal: TrainingGoal,
): Promise<SplitPlan> {
  const res = await api.post<SplitPlan>("/splits/generate", {
    days_per_week: daysPerWeek,
    experience_level: experienceLevel,
    goal,
  });
  return res.data;
}

export async function fetchActiveSplit(): Promise<SplitPlan | null> {
  const res = await api.get<SplitPlan | null>("/splits/active");
  return res.data;
}

export interface DayCompletion {
  day_index: number;
  completed: boolean;
}

export async function toggleDayComplete(splitId: string, dayIndex: number): Promise<DayCompletion> {
  const res = await api.post<DayCompletion>(`/splits/${splitId}/days/${dayIndex}/toggle-complete`);
  return res.data;
}

export async function listSplits(): Promise<SplitSummary[]> {
  const res = await api.get<SplitSummary[]>("/splits");
  return res.data;
}

export async function activateSplit(splitId: string): Promise<SplitPlan> {
  const res = await api.post<SplitPlan>(`/splits/${splitId}/activate`);
  return res.data;
}
