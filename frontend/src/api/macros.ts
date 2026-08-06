import { api } from "../lib/api";
import type { MacroGoal, MacroTarget } from "../types/macro";

export async function calculateMacros(goal: MacroGoal, weightKg?: number): Promise<MacroTarget> {
  const res = await api.post<MacroTarget>("/macros/calculate", {
    goal,
    weight_kg: weightKg,
  });
  return res.data;
}

export async function fetchActiveMacroTarget(): Promise<MacroTarget | null> {
  const res = await api.get<MacroTarget | null>("/macros/active");
  return res.data;
}

export async function fetchMacroHistory(): Promise<MacroTarget[]> {
  const res = await api.get<MacroTarget[]>("/macros/history");
  return res.data;
}
