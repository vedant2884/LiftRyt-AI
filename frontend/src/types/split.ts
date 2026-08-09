import type { ExerciseCategory, MovementType } from "./exercise";
import type { ExperienceLevel } from "./user";

export type TrainingGoal = "strength" | "hypertrophy" | "general_fitness";

export interface SplitExercise {
  exercise_id: string;
  name: string;
  category: ExerciseCategory;
  movement_type: MovementType;
  sets: number;
  reps: string;
  reason: string;
}

export interface SplitDay {
  day_number: number;
  label: string;
  exercises: SplitExercise[];
}

export interface SplitPlan {
  id: string;
  split_type: string;
  days_per_week: number;
  experience_level: ExperienceLevel;
  goal: TrainingGoal;
  days: SplitDay[];
  completed_day_numbers: number[];
  next_day_number: number;
}

/** Lean shape for browsing saved splits (GET /splits) — no plan/exercise
 * payload, just enough to pick one to activate. */
export interface SplitSummary {
  id: string;
  split_type: string;
  days_per_week: number;
  experience_level: ExperienceLevel;
  goal: TrainingGoal;
  is_active: boolean;
  created_at: string;
}
