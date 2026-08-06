export type MacroGoal = "cut" | "maintain" | "bulk";

export interface MacroTarget {
  id: string;
  bmr: number;
  tdee: number;
  goal: MacroGoal;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  is_active: boolean;
  created_at: string;
}
