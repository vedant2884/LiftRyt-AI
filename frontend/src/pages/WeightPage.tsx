import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { deleteWeightLog, fetchWeightAnalytics, fetchWeightLogs, logWeight } from "../api/weight";
import { EmptyState } from "../components/EmptyState";
import { ScaleIcon } from "../components/icons";
import { StatCardSkeletonRow } from "../components/Skeleton";
import { getChartTheme } from "../lib/chartTheme";
import { toast } from "../store/toastStore";
import { useThemeStore } from "../store/themeStore";
import type { WeightAnalytics, WeightLog } from "../types/weight";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WeightPage() {
  const mode = useThemeStore((s) => s.theme);
  const chart = getChartTheme(mode);
  const tooltipStyle = {
    background: chart.chartSurface,
    border: `1px solid ${chart.axisLine}`,
    borderRadius: 8,
    fontSize: 12,
  };

  const [analytics, setAnalytics] = useState<WeightAnalytics | null>(null);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [a, l] = await Promise.all([fetchWeightAnalytics(), fetchWeightLogs()]);
    setAnalytics(a);
    setLogs(l);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  function focusWeightInput() {
    weightInputRef.current?.focus();
    weightInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const weight_kg = Number(weightInput);
    if (!weight_kg || weight_kg <= 0) {
      setError("Enter a valid weight.");
      return;
    }
    setSaving(true);
    try {
      await logWeight({ weight_kg, logged_at: dateInput, note: noteInput || undefined });
      setWeightInput("");
      setNoteInput("");
      await refresh();
      toast.success("Weight logged");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteWeightLog(id);
    await refresh();
  }

  const trend = analytics?.trend;
  const rateDirection =
    trend?.rate_kg_per_week == null ? null : trend.rate_kg_per_week < 0 ? "down" : "up";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">Weight Tracker</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4"
      >
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="weight">
            Weight (kg)
          </label>
          <input
            ref={weightInputRef}
            id="weight"
            type="number"
            step="0.1"
            required
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="w-28 rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="min-w-[180px] flex-1 space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="note">
            Note (optional)
          </label>
          <input
            id="note"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
        >
          {saving ? "Saving..." : "Log weight"}
        </button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      {loading && <StatCardSkeletonRow />}

      {!loading && logs.length === 0 && (
        <div className="mb-8 rounded-xl border border-line bg-surface">
          <EmptyState
            icon={ScaleIcon}
            message="No weight logged yet. Log your first entry to start tracking your trend."
            actionLabel="Log your first entry"
            onAction={focusWeightInput}
          />
        </div>
      )}

      {!loading && analytics && logs.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-ink-muted">Current weight</p>
            <p className="mt-1 text-2xl font-semibold">
              {analytics.current_weight_kg != null ? `${analytics.current_weight_kg} kg` : "—"}
            </p>
            {analytics.current_weight_kg == null && (
              <p className="mt-1 text-xs text-ink-muted">Log an entry below to see this.</p>
            )}
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-ink-muted">Rate of change</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                rateDirection === "down"
                  ? "text-emerald-400"
                  : rateDirection === "up"
                    ? "text-amber-400"
                    : ""
              }`}
            >
              {trend?.rate_kg_per_week != null ? `${trend.rate_kg_per_week} kg/wk` : "—"}
            </p>
            {trend?.rate_kg_per_week == null && (
              <p className="mt-1 text-xs text-ink-muted">Log at least 2 entries to see your trend.</p>
            )}
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-ink-muted">Projected goal date</p>
            <p className="mt-1 text-2xl font-semibold">
              {trend?.projected_goal_date ? formatDate(trend.projected_goal_date) : "—"}
            </p>
            {trend?.goal_weight_kg != null && trend?.projected_goal_date ? (
              <p className="mt-0.5 text-xs text-ink-muted">at {trend.goal_weight_kg} kg goal</p>
            ) : trend?.goal_weight_kg == null ? (
              <p className="mt-1 text-xs text-ink-muted">
                <Link to="/profile" className="text-accent hover:underline">
                  Set a goal weight
                </Link>{" "}
                to see a projection.
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">Needs a clear trend to project a date.</p>
            )}
          </div>
        </div>
      )}

      {analytics && analytics.series.length > 1 && (
        <div className="mb-8 rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-4 text-sm font-medium text-ink-secondary">
            Weight over time, with 7-day and 30-day moving averages
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics.series} margin={{ left: 0 }}>
              <CartesianGrid stroke={chart.gridline} vertical={false} />
              <XAxis
                dataKey="logged_at"
                tickFormatter={formatDate}
                stroke={chart.axisLine}
                tick={{ fill: chart.textMuted, fontSize: 11 }}
                minTickGap={30}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                stroke={chart.axisLine}
                tick={{ fill: chart.textMuted, fontSize: 11 }}
                width={44}
              />
              <Tooltip
                labelFormatter={(v) => formatDate(String(v))}
                contentStyle={tooltipStyle}
                labelStyle={{ color: chart.textSecondary }}
                cursor={{ stroke: chart.axisLine }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: chart.textSecondary }} />
              <Line
                type="monotone"
                dataKey="weight_kg"
                name="Weight"
                stroke={chart.seriesBlue}
                strokeWidth={2}
                dot={false}
                strokeOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="moving_avg_7d"
                name="7-day avg"
                stroke={chart.seriesOrange}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="moving_avg_30d"
                name="30-day avg"
                stroke={chart.seriesAqua}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {analytics && analytics.weekly_averages.length > 0 && (
        <div className="mb-8 rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-4 text-sm font-medium text-ink-secondary">Weekly average weight</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.weekly_averages} margin={{ left: 0 }}>
              <CartesianGrid stroke={chart.gridline} vertical={false} />
              <XAxis
                dataKey="week_start"
                tickFormatter={formatDate}
                stroke={chart.axisLine}
                tick={{ fill: chart.textMuted, fontSize: 11 }}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                stroke={chart.axisLine}
                tick={{ fill: chart.textMuted, fontSize: 11 }}
                width={44}
              />
              <Tooltip
                labelFormatter={(v) => formatDate(String(v))}
                contentStyle={tooltipStyle}
                labelStyle={{ color: chart.textSecondary }}
                cursor={{ fill: chart.gridline }}
              />
              <Bar
                dataKey="avg_weight_kg"
                name="Weekly avg (kg)"
                fill={chart.seriesBlue}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {logs.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-secondary">Recent entries</h2>
          <ul className="divide-y divide-line">
            {logs.slice(0, 10).map((log) => (
              <li key={log.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{log.weight_kg} kg</span>
                  <span className="ml-2 text-ink-muted">{formatDate(log.logged_at)}</span>
                  {log.note && <span className="ml-2 text-ink-muted">&middot; {log.note}</span>}
                </div>
                <button
                  onClick={() => handleDelete(log.id)}
                  className="text-xs text-ink-muted hover:text-red-400"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
