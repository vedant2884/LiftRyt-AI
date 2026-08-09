import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Dumbbell, Flame, LineChart as LineChartIcon, Trophy } from "lucide-react";
import {
  fetchExerciseProgression,
  fetchMuscleVolume,
  fetchPersonalRecords,
  fetchWeeklyVolume,
  fetchWorkoutOverview,
  listWorkouts,
} from "../api/workouts";
import { EmptyState } from "../components/EmptyState";
import { Skeleton, StatCardSkeletonRow } from "../components/Skeleton";
import { getChartTheme } from "../lib/chartTheme";
import { useThemeStore } from "../store/themeStore";
import type {
  ExerciseProgressionStats,
  MuscleVolume,
  PersonalRecord,
  WeeklyVolume,
  WorkoutOverview,
  WorkoutSummary,
} from "../types/workout";

const humanize = (s: string) => s.replace(/_/g, " ");

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatWeekLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-secondary">{sub}</p>}
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof Trophy; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
      <Icon size={17} className="text-accent" />
      {title}
    </h2>
  );
}

export default function WorkoutAnalysisPage() {
  const mode = useThemeStore((s) => s.theme);
  const chart = getChartTheme(mode);
  const tooltipStyle = {
    background: chart.chartSurface,
    border: `1px solid ${chart.axisLine}`,
    borderRadius: 8,
    fontSize: 12,
  };

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WorkoutOverview | null>(null);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<WeeklyVolume[]>([]);
  const [muscleVolume, setMuscleVolume] = useState<MuscleVolume[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [progression, setProgression] = useState<ExerciseProgressionStats | null>(null);
  const [progressionLoading, setProgressionLoading] = useState(false);

  const [historyQuery, setHistoryQuery] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyExerciseId, setHistoryExerciseId] = useState<string>("");
  const [historyExerciseWorkoutIds, setHistoryExerciseWorkoutIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    Promise.all([
      fetchWorkoutOverview(),
      fetchPersonalRecords(),
      fetchWeeklyVolume(),
      fetchMuscleVolume(),
      listWorkouts(),
    ]).then(([overviewRes, prsRes, weeklyRes, muscleRes, workoutsRes]) => {
      setOverview(overviewRes);
      setPrs(prsRes);
      setWeeklyVolume(weeklyRes);
      setMuscleVolume(muscleRes);
      setWorkouts(workoutsRes);
      if (prsRes.length > 0) setSelectedExerciseId(prsRes[0].exercise_id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedExerciseId) return;
    setProgressionLoading(true);
    fetchExerciseProgression(selectedExerciseId)
      .then(setProgression)
      .finally(() => setProgressionLoading(false));
  }, [selectedExerciseId]);

  useEffect(() => {
    if (!historyExerciseId) {
      setHistoryExerciseWorkoutIds(null);
      return;
    }
    fetchExerciseProgression(historyExerciseId).then((stats) => {
      setHistoryExerciseWorkoutIds(new Set(stats.series.map((p) => p.workout_id)));
    });
  }, [historyExerciseId]);

  const monthlyVolume = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const w of weeklyVolume) {
      const monthKey = w.week_start.slice(0, 7);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + w.volume_kg);
    }
    return Array.from(byMonth.entries())
      .map(([month, volume_kg]) => ({ month, volume_kg }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [weeklyVolume]);

  const muscleVolumeTotals = useMemo(() => {
    const byMuscle = new Map<string, number>();
    for (const row of muscleVolume) {
      byMuscle.set(row.muscle, (byMuscle.get(row.muscle) ?? 0) + row.volume_kg);
    }
    return Array.from(byMuscle.entries())
      .map(([muscle, volume_kg]) => ({ muscle, volume_kg }))
      .sort((a, b) => b.volume_kg - a.volume_kg)
      .slice(0, 8);
  }, [muscleVolume]);

  const maxMuscleVolume = Math.max(1, ...muscleVolumeTotals.map((m) => m.volume_kg));

  const filteredHistory = useMemo(() => {
    return workouts.filter((w) => {
      if (historyQuery.trim() && !w.name.toLowerCase().includes(historyQuery.trim().toLowerCase())) {
        return false;
      }
      const performedDate = w.performed_at.slice(0, 10);
      if (historyFrom && performedDate < historyFrom) return false;
      if (historyTo && performedDate > historyTo) return false;
      if (historyExerciseWorkoutIds && !historyExerciseWorkoutIds.has(w.id)) return false;
      return true;
    });
  }, [workouts, historyQuery, historyFrom, historyTo, historyExerciseWorkoutIds]);

  if (loading) {
    return (
      <div className="space-y-8">
        <StatCardSkeletonRow count={4} />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (overview && overview.total_workouts === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        message="Log a workout to start seeing your analysis — PRs, progression, and volume all build from your real training data."
        actionLabel="Go log a workout"
        to="/workouts"
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* A. Overview */}
      <section>
        <SectionHeading icon={Flame} title="Overview" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total workouts" value={String(overview?.total_workouts ?? 0)} />
          <StatCard label="This week" value={String(overview?.workouts_this_week ?? 0)} />
          <StatCard label="This month" value={String(overview?.workouts_this_month ?? 0)} />
          <StatCard label="Total sets" value={String(overview?.total_sets ?? 0)} />
          <StatCard label="Total volume" value={`${Math.round(overview?.total_volume_kg ?? 0)} kg`} />
          <StatCard
            label="Most trained muscle"
            value={overview?.most_trained_muscle ? humanize(overview.most_trained_muscle) : "—"}
          />
          <StatCard
            label="Most trained exercise"
            value={overview?.most_trained_exercise_name ?? "—"}
          />
        </div>
      </section>

      {/* B. Personal Records */}
      <section>
        <SectionHeading icon={Trophy} title="Personal records" />
        {prs.length === 0 ? (
          <p className="text-sm text-ink-muted">No PRs yet — your first logged set on any exercise counts.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prs.map((pr) => (
              <button
                key={pr.exercise_id}
                type="button"
                onClick={() => setSelectedExerciseId(pr.exercise_id)}
                className={`rounded-xl border p-4 text-left transition hover:border-accent/50 ${
                  selectedExerciseId === pr.exercise_id
                    ? "border-accent bg-accent/5"
                    : "border-line bg-surface"
                }`}
              >
                <p className="truncate font-medium">{pr.exercise_name}</p>
                <p className="mt-1 text-lg font-semibold text-accent">
                  {pr.weight_kg} kg &times; {pr.reps}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">PR achieved {formatDate(pr.performed_at)}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* C. Exercise Progression */}
      <section>
        <SectionHeading icon={LineChartIcon} title="Exercise progression" />
        {prs.length === 0 ? (
          <p className="text-sm text-ink-muted">Log a few sessions on an exercise to see it progress here.</p>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-4">
            <select
              value={selectedExerciseId ?? ""}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="mb-4 rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {prs.map((pr) => (
                <option key={pr.exercise_id} value={pr.exercise_id}>
                  {pr.exercise_name}
                </option>
              ))}
            </select>

            {progressionLoading && <Skeleton className="h-56 w-full rounded-lg" />}

            {!progressionLoading && progression && (
              <>
                {progression.series.length > 1 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={progression.series} margin={{ left: 0 }}>
                      <CartesianGrid stroke={chart.gridline} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke={chart.axisLine}
                        tick={{ fill: chart.textMuted, fontSize: 11 }}
                        minTickGap={30}
                      />
                      <YAxis
                        domain={["dataMin - 2", "dataMax + 2"]}
                        stroke={chart.axisLine}
                        tick={{ fill: chart.textMuted, fontSize: 11 }}
                        width={40}
                      />
                      <Tooltip
                        labelFormatter={(v) => formatDate(String(v))}
                        formatter={(value) => [`${value} kg`, "Weight"]}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: chart.textSecondary }}
                        cursor={{ stroke: chart.axisLine }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight_kg"
                        stroke={chart.seriesBlue}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-ink-muted">
                    Log this exercise again to start a trend line.
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <StatCard
                    label="Best weight"
                    value={progression.best_weight_kg != null ? `${progression.best_weight_kg} kg` : "—"}
                    sub={progression.best_weight_reps != null ? `× ${progression.best_weight_reps}` : undefined}
                  />
                  <StatCard
                    label="Est. 1RM"
                    value={
                      progression.best_estimated_1rm_kg != null
                        ? `${progression.best_estimated_1rm_kg} kg`
                        : "—"
                    }
                    sub="Epley estimate"
                  />
                  <StatCard label="Total volume" value={`${Math.round(progression.total_volume_kg)} kg`} />
                  <StatCard label="Sessions" value={String(progression.session_count)} />
                  <StatCard
                    label="First performed"
                    value={progression.first_performed_at ? formatDate(progression.first_performed_at) : "—"}
                  />
                  <StatCard
                    label="Last performed"
                    value={progression.last_performed_at ? formatDate(progression.last_performed_at) : "—"}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* D. Volume Analysis */}
      <section>
        <SectionHeading icon={Dumbbell} title="Volume analysis" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">Weekly volume</h3>
            {weeklyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyVolume} margin={{ left: 0 }}>
                  <CartesianGrid stroke={chart.gridline} vertical={false} />
                  <XAxis
                    dataKey="week_start"
                    tickFormatter={formatWeekLabel}
                    stroke={chart.axisLine}
                    tick={{ fill: chart.textMuted, fontSize: 11 }}
                    minTickGap={20}
                  />
                  <YAxis stroke={chart.axisLine} tick={{ fill: chart.textMuted, fontSize: 11 }} width={44} />
                  <Tooltip
                    labelFormatter={(v) => formatWeekLabel(String(v))}
                    formatter={(value) => [`${Math.round(Number(value))} kg`, "Volume"]}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chart.textSecondary }}
                    cursor={{ fill: chart.gridline }}
                  />
                  <Bar dataKey="volume_kg" fill={chart.seriesBlue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">Not enough data yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-ink-secondary">Volume by muscle</h3>
            {muscleVolumeTotals.length > 0 ? (
              <div className="space-y-2.5">
                {muscleVolumeTotals.map((row) => (
                  <div key={row.muscle}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="capitalize text-ink-secondary">{humanize(row.muscle)}</span>
                      <span className="text-ink-muted">{Math.round(row.volume_kg)} kg</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(row.volume_kg / maxMuscleVolume) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">Not enough data yet.</p>
            )}
          </div>

          {monthlyVolume.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4 lg:col-span-2">
              <h3 className="mb-3 text-sm font-medium text-ink-secondary">Monthly volume</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyVolume} margin={{ left: 0 }}>
                  <CartesianGrid stroke={chart.gridline} vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke={chart.axisLine}
                    tick={{ fill: chart.textMuted, fontSize: 11 }}
                  />
                  <YAxis stroke={chart.axisLine} tick={{ fill: chart.textMuted, fontSize: 11 }} width={44} />
                  <Tooltip
                    formatter={(value) => [`${Math.round(Number(value))} kg`, "Volume"]}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chart.textSecondary }}
                    cursor={{ fill: chart.gridline }}
                  />
                  <Bar dataKey="volume_kg" fill={chart.seriesAqua} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* E. Workout History */}
      <section>
        <SectionHeading icon={Dumbbell} title="Workout history" />
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search by workout name..."
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="date"
            value={historyFrom}
            onChange={(e) => setHistoryFrom(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="date"
            value={historyTo}
            onChange={(e) => setHistoryTo(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={historyExerciseId}
            onChange={(e) => setHistoryExerciseId(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">All exercises</option>
            {prs.map((pr) => (
              <option key={pr.exercise_id} value={pr.exercise_id}>
                {pr.exercise_name}
              </option>
            ))}
          </select>
        </div>

        {filteredHistory.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">No workouts match those filters.</p>
        ) : (
          <div className="space-y-2">
            {filteredHistory.map((w) => (
              <Link
                key={w.id}
                to={`/workouts/${w.id}`}
                className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{w.name}</p>
                  <p className="text-xs text-ink-muted">{formatDate(w.performed_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-ink-secondary">
                  <span>{w.set_count} sets</span>
                  <span>{Math.round(w.total_volume_kg)} kg</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
