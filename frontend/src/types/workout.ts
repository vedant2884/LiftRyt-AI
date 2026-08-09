export interface WorkoutSetCreate {
  exercise_id?: string;
  custom_exercise_id?: string;
  reps: number;
  weight_kg: number;
  rpe?: number;
  is_warmup?: boolean;
}

export interface WorkoutSet {
  id: string;
  exercise_id: string | null;
  custom_exercise_id: string | null;
  is_custom: boolean;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_warmup: boolean;
  is_pr: boolean;
  // Set only alongside is_pr — the increment the "Increase next weight?"
  // prompt would offer if the user confirms. Null when it isn't a PR, or
  // when progression is disabled for this exercise.
  suggested_increment_kg: number | null;
  created_at: string;
}

export interface WorkoutSummary {
  id: string;
  name: string;
  performed_at: string;
  notes: string | null;
  duration_seconds: number | null;
  set_count: number;
  total_volume_kg: number;
}

export interface WorkoutDetail {
  id: string;
  name: string;
  performed_at: string;
  notes: string | null;
  duration_seconds: number | null;
  sets: WorkoutSet[];
}

export interface WorkoutCreatePayload {
  name: string;
  performed_at?: string;
  notes?: string;
}

export interface WorkoutUpdatePayload {
  name?: string;
  notes?: string;
  duration_seconds?: number;
}

export interface RecentExercise {
  id: string;
  is_custom: boolean;
  name: string;
  primary_muscles: string[];
  equipment: string;
  last_used_at: string;
}

export interface ProgressionSessionPoint {
  workout_id: string;
  date: string;
  weight_kg: number;
  reps: number;
}

export interface ExerciseProgressionStats {
  exercise_id: string;
  exercise_name: string;
  series: ProgressionSessionPoint[];
  best_weight_kg: number | null;
  best_weight_reps: number | null;
  /** Epley-formula estimate, not a tested max — label it as such in the UI. */
  best_estimated_1rm_kg: number | null;
  total_volume_kg: number;
  session_count: number;
  first_performed_at: string | null;
  last_performed_at: string | null;
}

export interface PersonalRecord {
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  performed_at: string;
}

export interface WeeklyVolume {
  week_start: string;
  volume_kg: number;
  workout_count: number;
}

export interface MuscleVolume {
  week_start: string;
  muscle: string;
  volume_kg: number;
}

export interface WorkoutOverview {
  total_workouts: number;
  workouts_this_week: number;
  workouts_this_month: number;
  total_volume_kg: number;
  total_sets: number;
  most_trained_muscle: string | null;
  most_trained_exercise_name: string | null;
}
