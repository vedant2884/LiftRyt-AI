import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createWorkout,
  deleteWorkout,
  fetchPersonalRecords,
  fetchWeeklyVolume,
  fetchWorkouts,
} from "../api/workouts";
import { getChartTheme } from "../lib/chartTheme";
import { useThemeStore } from "../store/themeStore";
import type { PersonalRecord, WeeklyVolume, WorkoutSummary } from "../types/workout";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WorkoutsPage() {
  const navigate = useNavigate();
  const mode = useThemeStore((s) => s.theme);
  const chart = getChartTheme(mode);
  const tooltipStyle = {
    background: chart.chartSurface,
    border: `1px solid ${chart.axisLine}`,
    borderRadius: 8,
    fontSize: 12,
  };

  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [volume, setVolume] = useState<WeeklyVolume[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const [w, p, v] = await Promise.all([
      fetchWorkouts(),
      fetchPersonalRecords(),
      fetchWeeklyVolume(),
    ]);
    setWorkouts(w);
    setPrs(p);
    setVolume(v);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const workout = await createWorkout({
        name: name.trim(),
        performed_at: new Date(date + "T12:00:00").toISOString(),
      });
      navigate(`/workouts/${workout.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteWorkout(id);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Workouts</h1>

      <form
        onSubmit={handleCreate}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4"
      >
        <div className="min-w-[180px] flex-1 space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="workout-name">
            Workout name
          </label>
          <input
            id="workout-name"
            placeholder="e.g. Push Day"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="workout-date">
            Date
          </label>
          <input
            id="workout-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Starting..." : "Start workout"}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium text-ink-secondary">History</h2>
          {workouts.length === 0 ? (
            <p className="text-sm text-ink-muted">No workouts logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {workouts.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface p-4"
                >
                  <Link to={`/workouts/${w.id}`} className="flex-1">
                    <p className="font-medium">{w.name}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(w.performed_at)} &middot; {w.set_count} sets &middot;{" "}
                      {w.total_volume_kg.toLocaleString()} kg volume
                    </p>
                  </Link>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="text-xs text-ink-muted hover:text-red-400"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          {volume.length > 0 && (
            <div className="mt-6 rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-4 text-sm font-medium text-ink-secondary">Weekly training volume</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volume} margin={{ left: 0 }}>
                  <CartesianGrid stroke={chart.gridline} vertical={false} />
                  <XAxis
                    dataKey="week_start"
                    tickFormatter={formatDate}
                    stroke={chart.axisLine}
                    tick={{ fill: chart.textMuted, fontSize: 11 }}
                  />
                  <YAxis
                    stroke={chart.axisLine}
                    tick={{ fill: chart.textMuted, fontSize: 11 }}
                    width={50}
                  />
                  <Tooltip
                    labelFormatter={(v) => formatDate(String(v))}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chart.textSecondary }}
                    cursor={{ fill: chart.gridline }}
                  />
                  <Bar
                    dataKey="volume_kg"
                    name="Volume (kg)"
                    fill={chart.seriesBlue}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-ink-secondary">Personal records</h2>
          {prs.length === 0 ? (
            <p className="text-sm text-ink-muted">No PRs yet — log a set to start.</p>
          ) : (
            <ul className="space-y-2">
              {prs.map((pr) => (
                <li key={pr.exercise_id} className="rounded-xl border border-line bg-surface p-3">
                  <p className="text-sm font-medium">{pr.exercise_name}</p>
                  <p className="text-xs text-ink-muted">
                    {pr.weight_kg} kg &times; {pr.reps} &middot; {formatDate(pr.performed_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
