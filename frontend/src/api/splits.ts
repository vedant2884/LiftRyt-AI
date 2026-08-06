import { api } from "../lib/api";
import type { SplitPlan, TrainingGoal } from "../types/split";
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
