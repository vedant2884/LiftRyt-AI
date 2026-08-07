import { useState } from "react";
import { generateSplit } from "../api/splits";
import { useAuthStore } from "../store/authStore";
import type { SplitPlan, TrainingGoal } from "../types/split";
import type { ExperienceLevel } from "../types/user";

const GOALS: { value: TrainingGoal; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "general_fitness", label: "General fitness" },
];

const selectClass =
  "rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent";

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
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      setPlan(await generateSplit(daysPerWeek, experienceLevel, goal));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Workout Split Generator</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Rule-based, not AI-guessed — every exercise below is picked deterministically from your
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
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate split"}
        </button>
      </div>

      {plan && (
        <div>
          <p className="mb-4 text-sm text-ink-secondary">
            <span className="font-medium text-ink">{plan.split_type}</span> &middot;{" "}
            {plan.days_per_week} days/week &middot; {plan.goal.replace("_", " ")}
          </p>
          <div className="space-y-4">
            {plan.days.map((day) => (
              <div
                key={day.day_number}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <h2 className="mb-3 font-medium">
                  Day {day.day_number}: {day.label}
                </h2>
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
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
