import type { ExerciseCategory, MovementType } from "./exercise";
import type { ExperienceLevel } from "./user";

export interface CustomExercise {
  id: string;
  name: string;
  description: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string;
  movement_type: MovementType;
  category: ExerciseCategory;
  difficulty: ExperienceLevel;
  created_at: string;
}

export interface CustomExercisePayload {
  name: string;
  description?: string;
  primary_muscles: string[];
  secondary_muscles?: string[];
  equipment: string;
  movement_type: MovementType;
  category: ExerciseCategory;
  difficulty: ExperienceLevel;
}

export interface FavoriteExercise {
  id: string;
  exercise_id: string | null;
  custom_exercise_id: string | null;
  is_custom: boolean;
  position: number;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string;
  movement_type: MovementType;
  category: ExerciseCategory;
  difficulty: ExperienceLevel;
}

export type RecommendationType =
  | "missing_muscle_group"
  | "variation"
  | "adherence"
  | "progression"
  | "goal_based";

export interface RecommendationExercise {
  id: string;
  name: string;
  description: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string;
  movement_type: MovementType;
  category: ExerciseCategory;
  difficulty: ExperienceLevel;
}

export interface RecommendationCard {
  type: RecommendationType;
  title: string;
  description: string;
  exercises: RecommendationExercise[];
  action_label: string | null;
  action_href: string | null;
}

export interface Recommendations {
  cards: RecommendationCard[];
  generated_at: string;
}
