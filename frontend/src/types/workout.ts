export interface WorkoutSet {
  id: string;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_warmup: boolean;
  is_pr: boolean;
  created_at: string;
}

export interface WorkoutSummary {
  id: string;
  name: string;
  performed_at: string;
  notes: string | null;
  set_count: number;
  total_volume_kg: number;
}

export interface WorkoutDetail {
  id: string;
  name: string;
  performed_at: string;
  notes: string | null;
  sets: WorkoutSet[];
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
