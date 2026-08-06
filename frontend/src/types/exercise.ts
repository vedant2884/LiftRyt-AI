export type MovementType = "compound" | "isolation";
export type ExerciseCategory = "push" | "pull" | "legs" | "upper" | "lower" | "full_body" | "core";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Exercise {
  id: string;
  name: string;
  description: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string;
  movement_type: MovementType;
  category: ExerciseCategory;
  difficulty: Difficulty;
}

export interface ExerciseListResponse {
  items: Exercise[];
  total: number;
}
