export interface WeightLog {
  id: string;
  weight_kg: number;
  logged_at: string;
  note: string | null;
  created_at: string;
}

export interface WeightSeriesPoint {
  logged_at: string;
  weight_kg: number;
  moving_avg_7d: number | null;
  moving_avg_30d: number | null;
}

export interface WeeklyAverage {
  week_start: string;
  avg_weight_kg: number;
  entries: number;
}

export interface WeightTrend {
  rate_kg_per_week: number | null;
  projected_goal_date: string | null;
  goal_weight_kg: number | null;
}

export interface WeightAnalytics {
  current_weight_kg: number | null;
  latest_logged_at: string | null;
  series: WeightSeriesPoint[];
  weekly_averages: WeeklyAverage[];
  trend: WeightTrend;
}
