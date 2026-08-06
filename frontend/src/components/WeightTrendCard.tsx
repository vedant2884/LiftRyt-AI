import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchWeightAnalytics } from "../api/weight";
import type { WeightAnalytics } from "../types/weight";

export default function WeightTrendCard() {
  const [analytics, setAnalytics] = useState<WeightAnalytics | null>(null);

  useEffect(() => {
    fetchWeightAnalytics().then(setAnalytics);
  }, []);

  if (!analytics || analytics.current_weight_kg == null) {
    return (
      <Link
        to="/weight"
        className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
      >
        <p className="text-sm text-neutral-400">No weight logged yet</p>
        <p className="mt-1 text-xs text-violet-400">Log your first entry &rarr;</p>
      </Link>
    );
  }

  const rate = analytics.trend.rate_kg_per_week;
  const rateColor = rate == null ? "text-neutral-500" : rate < 0 ? "text-emerald-400" : "text-amber-400";

  return (
    <Link
      to="/weight"
      className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
    >
      <p className="text-xs text-neutral-500">Current weight</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-2xl font-semibold">{analytics.current_weight_kg} kg</span>
        {rate != null && (
          <span className={`text-sm font-medium ${rateColor}`}>
            {rate > 0 ? "+" : ""}
            {rate} kg/wk
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-violet-400">View full tracker &rarr;</p>
    </Link>
  );
}
