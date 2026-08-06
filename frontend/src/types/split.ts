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
  split_type: string;
  days_per_week: number;
  experience_level: ExperienceLevel;
  goal: TrainingGoal;
  days: SplitDay[];
}
