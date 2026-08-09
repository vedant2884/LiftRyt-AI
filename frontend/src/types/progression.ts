export interface ExerciseProgression {
  id: string;
  exercise_id: string;
  exercise_name: string;
  /** Effective increment — increment_kg_override if set, else the user's
   * account-wide default. What a confirmed PR would actually use. */
  increment_kg: number;
  increment_kg_override: number | null;
  next_suggested_weight_kg: number | null;
  enabled: boolean;
}

export interface ConfirmProgressionPayload {
  exercise_id: string;
  pr_weight_kg: number;
}

export interface UpdateProgressionPayload {
  exercise_id: string;
  increment_kg?: number | null;
  enabled?: boolean;
  clear_suggestion?: boolean;
}

/** The choices offered in Settings and in the per-exercise override —
 * 2.5kg is only the default, never the only option (different gyms/
 * exercises use different plates/machines). */
export const INCREMENT_PRESETS_KG = [1.25, 2.5, 5, 7.5] as const;
