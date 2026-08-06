import { type FormEvent, useEffect, useState } from "react";
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
import {
  axisLine,
  chartSurface,
  gridline,
  seriesAqua,
  seriesBlue,
  seriesOrange,
  textMuted,
  textSecondary,
} from "../lib/chartTheme";
import type { WeightAnalytics, WeightLog } from "../types/weight";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const tooltipStyle = {
  background: chartSurface,
  border: `1px solid ${axisLine}`,
  borderRadius: 8,
  fontSize: 12,
};

export default function WeightPage() {
  const [analytics, setAnalytics] = useState<WeightAnalytics | null>(null);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [a, l] = await Promise.all([fetchWeightAnalytics(), fetchWeightLogs()]);
    setAnalytics(a);
    setLogs(l);
  }

  useEffect(() => {
    refresh();
  }, []);

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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Weight Tracker</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
      >
        <div className="space-y-1">
          <label className="text-xs text-neutral-500" htmlFor="weight">
            Weight (kg)
          </label>
          <input
            id="weight"
            type="number"
            step="0.1"
            required
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="w-28 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>
        <div className="min-w-[180px] flex-1 space-y-1">
          <label className="text-xs text-neutral-500" htmlFor="note">
            Note (optional)
          </label>
          <input
            id="note"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-violet-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Log weight"}
        </button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      {analytics && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">Current weight</p>
            <p className="mt-1 text-2xl font-semibold">
              {analytics.current_weight_kg != null ? `${analytics.current_weight_kg} kg` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">Rate of change</p>
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
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">Projected goal date</p>
            <p className="mt-1 text-2xl font-semibold">
              {trend?.projected_goal_date ? formatDate(trend.projected_goal_date) : "—"}
            </p>
            {trend?.goal_weight_kg != null && (
              <p className="mt-0.5 text-xs text-neutral-500">at {trend.goal_weight_kg} kg goal</p>
            )}
          </div>
        </div>
      )}

      {analytics && analytics.series.length > 1 && (
        <div className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-4 text-sm font-medium text-neutral-300">
            Weight over time — with 7-day and 30-day moving averages
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics.series} margin={{ left: 0 }}>
              <CartesianGrid stroke={gridline} vertical={false} />
              <XAxis
                dataKey="logged_at"
                tickFormatter={formatDate}
                stroke={axisLine}
                tick={{ fill: textMuted, fontSize: 11 }}
                minTickGap={30}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                stroke={axisLine}
                tick={{ fill: textMuted, fontSize: 11 }}
                width={44}
              />
              <Tooltip
                labelFormatter={(v) => formatDate(String(v))}
                contentStyle={tooltipStyle}
                labelStyle={{ color: textSecondary }}
                cursor={{ stroke: axisLine }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: textSecondary }} />
              <Line
                type="monotone"
                dataKey="weight_kg"
                name="Weight"
                stroke={seriesBlue}
                strokeWidth={2}
                dot={false}
                strokeOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="moving_avg_7d"
                name="7-day avg"
                stroke={seriesOrange}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="moving_avg_30d"
                name="30-day avg"
                stroke={seriesAqua}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {analytics && analytics.weekly_averages.length > 0 && (
        <div className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-4 text-sm font-medium text-neutral-300">Weekly average weight</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.weekly_averages} margin={{ left: 0 }}>
              <CartesianGrid stroke={gridline} vertical={false} />
              <XAxis
                dataKey="week_start"
                tickFormatter={formatDate}
                stroke={axisLine}
                tick={{ fill: textMuted, fontSize: 11 }}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                stroke={axisLine}
                tick={{ fill: textMuted, fontSize: 11 }}
                width={44}
              />
              <Tooltip
                labelFormatter={(v) => formatDate(String(v))}
                contentStyle={tooltipStyle}
                labelStyle={{ color: textSecondary }}
                cursor={{ fill: gridline }}
              />
              <Bar dataKey="avg_weight_kg" name="Weekly avg (kg)" fill={seriesBlue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {logs.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-medium text-neutral-300">Recent entries</h2>
          <ul className="divide-y divide-neutral-800">
            {logs.slice(0, 10).map((log) => (
              <li key={log.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{log.weight_kg} kg</span>
                  <span className="ml-2 text-neutral-500">{formatDate(log.logged_at)}</span>
                  {log.note && <span className="ml-2 text-neutral-600">— {log.note}</span>}
                </div>
                <button
                  onClick={() => handleDelete(log.id)}
                  className="text-xs text-neutral-500 hover:text-red-400"
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
