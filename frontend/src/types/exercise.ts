export type MovementType = "compound" | "isolation";
export type ExerciseCategory = "push" | "pull" | "legs" | "upper" | "lower" | "full_body" | "core";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type PreviewMediaType = "gif" | "mp4" | "webm";

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

  thumbnail_url: string | null;
  preview_media_url: string | null;
  preview_media_type: PreviewMediaType | null;

  instructions: string[] | null;
  common_mistakes: string[] | null;
  breathing_tips: string | null;
  range_of_motion: string | null;
  tempo: string | null;
  recommended_sets: string | null;
  recommended_reps: string | null;
  beginner_tips: string | null;
  advanced_tips: string | null;
  safety_notes: string | null;
}

export interface ExerciseListResponse {
  items: Exercise[];
  total: number;
}
