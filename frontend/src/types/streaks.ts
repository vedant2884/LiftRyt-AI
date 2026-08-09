export interface WeeklyAdherence {
  completed: number;
  planned: number;
}

export interface Streaks {
  logging_streak_days: number;
  weekly_adherence: WeeklyAdherence | null;
}
