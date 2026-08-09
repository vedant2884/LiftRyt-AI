import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWeightAnalytics } from "../api/weight";
import { useAuthStore } from "../store/authStore";
import { ScaleIcon } from "./icons";
import { Skeleton } from "./Skeleton";
import { formatWeight, kgToLb } from "../lib/units";
import type { WeightAnalytics } from "../types/weight";

export default function WeightTrendCard() {
  const unit = useAuthStore((s) => s.user?.unit_weight ?? "kg");
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<WeightAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeightAnalytics()
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-7 w-20" />
        <Skeleton className="mt-3 h-3 w-28" />
      </div>
    );
  }

  if (!analytics || analytics.current_weight_kg == null) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="mb-2 text-xs text-ink-muted">Weight trend</p>
        <div className="flex items-center gap-3">
          <ScaleIcon className="h-6 w-6 shrink-0 text-ink-muted" />
          <p className="text-sm text-ink-secondary">No weight logged yet.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/weight")}
          className="mt-3 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
        >
          Log your first entry
        </button>
      </div>
    );
  }

  const rate = analytics.trend.rate_kg_per_week;
  const rateDisplay = rate == null ? null : unit === "lb" ? kgToLb(rate) : rate;
  const rateColor = rate == null ? "text-ink-muted" : rate < 0 ? "text-emerald-400" : "text-amber-400";

  return (
    <Link
      to="/weight"
      className="block rounded-xl border border-line bg-surface p-5 transition hover:border-line-strong active:scale-[0.99]"
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
      <p className="mt-2 text-xs text-accent">View full tracker &rarr;</p>
    </Link>
  );
}
