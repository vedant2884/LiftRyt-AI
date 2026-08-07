import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchWeightAnalytics } from "../api/weight";
import { useAuthStore } from "../store/authStore";
import { formatWeight, kgToLb } from "../lib/units";
import type { WeightAnalytics } from "../types/weight";

export default function WeightTrendCard() {
  const unit = useAuthStore((s) => s.user?.unit_weight ?? "kg");
  const [analytics, setAnalytics] = useState<WeightAnalytics | null>(null);

  useEffect(() => {
    fetchWeightAnalytics().then(setAnalytics);
  }, []);

  if (!analytics || analytics.current_weight_kg == null) {
    return (
      <Link
        to="/weight"
        className="block rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong"
      >
        <p className="text-sm text-ink-secondary">No weight logged yet</p>
        <p className="mt-1 text-xs text-accent">Log your first entry &rarr;</p>
      </Link>
    );
  }

  const rate = analytics.trend.rate_kg_per_week;
  const rateDisplay = rate == null ? null : unit === "lb" ? kgToLb(rate) : rate;
  const rateColor = rate == null ? "text-ink-muted" : rate < 0 ? "text-emerald-400" : "text-amber-400";

  return (
    <Link
      to="/weight"
      className="block rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong"
    >
      <p className="text-xs text-ink-muted">Current weight</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-2xl font-semibold">
          {formatWeight(analytics.current_weight_kg, unit)}
        </span>
        {rateDisplay != null && (
          <span className={`text-sm font-medium ${rateColor}`}>
            {rateDisplay > 0 ? "+" : ""}
            {rateDisplay.toFixed(2)} {unit}/wk
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-accent">View full tracker &rarr;</p>
    </Link>
  );
}
