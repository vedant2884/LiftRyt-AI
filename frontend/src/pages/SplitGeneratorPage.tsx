import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { activateSplit, fetchActiveSplit, generateSplit, listSplits, toggleDayComplete } from "../api/splits";
import { EmptyState } from "../components/EmptyState";
import { DumbbellIcon } from "../components/icons";
import { Skeleton } from "../components/Skeleton";
import SplitExportCard from "../components/SplitExportCard";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import type { SplitPlan, SplitSummary, TrainingGoal } from "../types/split";
import type { ExperienceLevel } from "../types/user";

function formatSplitDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const GOALS: { value: TrainingGoal; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "general_fitness", label: "General fitness" },
];

// h-10 pinned explicitly (not just matching padding) — a native <select>'s
// browser-default chrome can render a couple px taller than a <button>
// with identical padding, which is what made this row look subtly
// misaligned despite both using py-2.
const selectClass =
  "h-10 rounded-md border border-line-strong bg-bg px-3 text-sm outline-none focus:border-accent";

const categoryColor: Record<string, string> = {
  push: "bg-blue-500/15 text-blue-400",
  pull: "bg-orange-500/15 text-orange-400",
  legs: "bg-emerald-500/15 text-emerald-400",
  core: "bg-violet-500/15 text-violet-400",
};

export default function SplitGeneratorPage() {
  const user = useAuthStore((s) => s.user);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    user?.training_experience ?? "beginner",
  );
  const [goal, setGoal] = useState<TrainingGoal>("hypertrophy");
  const [plan, setPlan] = useState<SplitPlan | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [togglingDay, setTogglingDay] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [savedSplits, setSavedSplits] = useState<SplitSummary[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveSplit()
      .then(setPlan)
      .finally(() => setInitialLoading(false));
    refreshSavedSplits();
  }, []);

  function refreshSavedSplits() {
    listSplits()
      .then(setSavedSplits)
      .catch(() => {
        // The "Your splits" list is a convenience over the primary
        // generate/view flow above — a failed fetch shouldn't block it.
      });
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generateSplit(daysPerWeek, experienceLevel, goal);
      setPlan(result);
      refreshSavedSplits();
      toast.success("Split generated");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(splitId: string) {
    setActivatingId(splitId);
    try {
      const result = await activateSplit(splitId);
      setPlan(result);
      refreshSavedSplits();
      toast.success("Preferred split updated");
    } catch {
      toast.error("Couldn't set that as your preferred split. Please try again.");
    } finally {
      setActivatingId(null);
    }
  }

  async function handleToggleComplete(dayNumber: number) {
    if (!plan) return;
    setTogglingDay(dayNumber);
    try {
      const result = await toggleDayComplete(plan.id, dayNumber);
      setPlan((prev) => {
        if (!prev) return prev;
        const completed = new Set(prev.completed_day_numbers);
        if (result.completed) completed.add(dayNumber);
        else completed.delete(dayNumber);
        return { ...prev, completed_day_numbers: Array.from(completed) };
      });
      if (result.completed) toast.success("Workout marked complete");
    } finally {
      setTogglingDay(null);
    }
  }

  async function handleExport() {
    if (!exportRef.current || !plan) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `liftryt-${plan.split_type.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Couldn't export the split image. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-2xl font-semibold">Workout Split Generator</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Rule-based, not AI-guessed. Every exercise below is picked deterministically from your
        exercise library, with the reasoning shown.
      </p>

      <div className="mb-8 flex flex-wrap items-end gap-4 rounded-xl border border-line bg-surface p-4">
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="days">
            Days per week
          </label>
          <select
            id="days"
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Number(e.target.value))}
            className={selectClass}
          >
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="experience">
            Experience level
          </label>
          <select
            id="experience"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
            className={selectClass}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-ink-muted" htmlFor="goal">
            Goal
          </label>
          <select
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value as TrainingGoal)}
            className={selectClass}
          >
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="h-10 rounded-md bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? "Generating..." : plan ? "Generate new split" : "Generate split"}
        </button>
      </div>

      {savedSplits.length > 1 && (
        <div className="mb-8 rounded-xl border border-line bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Your splits</p>
          <div className="space-y-2">
            {savedSplits.map((s) => (
              <div
                key={s.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 ${
                  s.is_active ? "border-accent/40 bg-accent/5" : "border-line"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.split_type} <span className="text-ink-muted">&middot; {s.days_per_week} days/week</span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {s.goal.replace("_", " ")} &middot; generated {formatSplitDate(s.created_at)}
                  </p>
                </div>
                {s.is_active ? (
                  <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                    Preferred
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleActivate(s.id)}
                    disabled={activatingId === s.id}
                    className="shrink-0 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium transition hover:bg-surface-hover active:scale-[0.97] disabled:opacity-50"
                  >
                    {activatingId === s.id ? "Setting..." : "Set as preferred"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {initialLoading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
      )}

      {!initialLoading && !plan && !loading && (
        <EmptyState
          icon={DumbbellIcon}
          message="You haven't generated a split yet."
          actionLabel="Generate your first split"
          onAction={handleGenerate}
        />
      )}

      {plan && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-secondary">
              <span className="font-medium text-ink">{plan.split_type}</span> &middot;{" "}
              {plan.days_per_week} days/week &middot; {plan.goal.replace("_", " ")}
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium transition hover:bg-surface-hover active:scale-[0.97] disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Export as PNG"}
            </button>
          </div>
          <div className="space-y-4">
            {plan.days.map((day) => {
              const isComplete = plan.completed_day_numbers.includes(day.day_number);
              return (
                <div
                  key={day.day_number}
                  className={`rounded-xl border p-4 transition ${
                    isComplete ? "border-emerald-500/40 bg-emerald-500/5" : "border-line bg-surface"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-medium">
                      Day {day.day_number}: {day.label}
                    </h2>
                    <button
                      onClick={() => handleToggleComplete(day.day_number)}
                      disabled={togglingDay === day.day_number}
                      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition active:scale-[0.97] disabled:opacity-50 ${
                        isComplete
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          : "border-line-strong text-ink-secondary hover:bg-surface-hover"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
                          isComplete ? "border-emerald-400 bg-emerald-400" : "border-ink-muted"
                        }`}
                      >
                        {isComplete && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      {isComplete ? "Completed" : "Mark complete"}
                    </button>
                  </div>
                  <ul className="space-y-3">
                    {day.exercises.map((ex) => (
                      <li key={ex.exercise_id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{ex.name}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${categoryColor[ex.category] ?? "bg-surface-hover text-ink-secondary"}`}
                            >
                              {ex.category}
                            </span>
                            <span className="text-sm text-ink-secondary">
                              {ex.sets} &times; {ex.reps}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-ink-muted">{ex.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plan && (
        <div style={{ position: "fixed", top: -9999, left: -9999, pointerEvents: "none" }} aria-hidden>
          <div ref={exportRef}>
            <SplitExportCard plan={plan} userName={user?.full_name ?? "My"} />
          </div>
        </div>
      )}
    </main>
  );
}
