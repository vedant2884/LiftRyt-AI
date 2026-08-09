import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { completeOnboarding, updateProfile } from "../api/auth";
import { fetchExercises } from "../api/exercises";
import { addFavorite } from "../api/favorites";
import { generateSplit } from "../api/splits";
import { logWeight } from "../api/weight";
import { toast } from "../store/toastStore";
import { useAuthStore } from "../store/authStore";
import type { Exercise } from "../types/exercise";
import type { SplitPlan, TrainingGoal } from "../types/split";
import type { ExperienceLevel } from "../types/user";

const STEPS = ["Goal weight", "First weigh-in", "Favorite exercises", "Your first split", "Meet your coach"];

const inputClass =
  "w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent";
const selectClass = inputClass;
const primaryButtonClass =
  "rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";
const skipClass = "text-sm text-ink-muted transition hover:text-ink-secondary";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [goalWeight, setGoalWeight] = useState(String(user?.goal_weight_kg ?? ""));
  const [weightInput, setWeightInput] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    user?.training_experience ?? "beginner",
  );
  const [goal, setGoal] = useState<TrainingGoal>("hypertrophy");
  const [plan, setPlan] = useState<SplitPlan | null>(null);

  const [sampleExercises, setSampleExercises] = useState<Exercise[]>([]);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchExercises({ limit: 18 }).then((res) => setSampleExercises(res.items));
  }, []);

  if (!user) return null;

  function toggleExerciseSelection(id: string) {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSaveFavorites() {
    setSaving(true);
    try {
      await Promise.all(
        Array.from(selectedExerciseIds).map((exercise_id) => addFavorite({ exercise_id })),
      );
      if (selectedExerciseIds.size > 0) toast.success("Favorites saved");
      setStep(3);
    } finally {
      setSaving(false);
    }
  }

  async function finish(destination: string) {
    setSaving(true);
    try {
      const updated = await completeOnboarding();
      if (accessToken) setAuth(accessToken, updated);
      navigate(destination);
    } finally {
      setSaving(false);
    }
  }

  async function handleGoalWeightContinue() {
    const value = Number(goalWeight);
    if (value > 0 && value !== user!.goal_weight_kg) {
      setSaving(true);
      try {
        const updated = await updateProfile({ goal_weight_kg: value });
        if (accessToken) setAuth(accessToken, updated);
      } finally {
        setSaving(false);
      }
    }
    setStep(1);
  }

  async function handleLogWeight() {
    const weight_kg = Number(weightInput);
    if (!weight_kg || weight_kg <= 0) return;
    setSaving(true);
    try {
      await logWeight({ weight_kg, logged_at: new Date().toISOString().slice(0, 10) });
      toast.success("Weight logged");
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSplit() {
    setSaving(true);
    try {
      const result = await generateSplit(daysPerWeek, experienceLevel, goal);
      setPlan(result);
      toast.success("Split generated");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-bg px-4 py-10 text-ink">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-accent" : "bg-surface-hover"}`}
              />
            ))}
          </div>
          <button
            onClick={() => finish("/dashboard")}
            disabled={saving}
            className={skipClass}
          >
            Skip onboarding
          </button>
        </div>

        <div className="rounded-xl border border-line bg-surface p-8">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Confirm your goal weight</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  This is what the coach and your dashboard track progress against.
                </p>
              </div>
              <input
                type="number"
                min={1}
                max={500}
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                className={inputClass}
              />
              <div className="flex justify-end">
                <button onClick={handleGoalWeightContinue} disabled={saving} className={primaryButtonClass}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Log your first weigh-in</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  This is what your weight trend and streak are built from.
                </p>
              </div>
              <input
                type="number"
                step="0.1"
                placeholder="Weight (kg)"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className={inputClass}
              />
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(2)} className={skipClass}>
                  Skip this step
                </button>
                <button
                  onClick={handleLogWeight}
                  disabled={saving || !weightInput}
                  className={primaryButtonClass}
                >
                  Log & continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Pick a few favorite exercises</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  The coach prioritizes these when it builds you a split, unless you ask for
                  something specific. You can add more any time from the Library.
                </p>
              </div>
              <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {sampleExercises.map((exercise) => {
                  const selected = selectedExerciseIds.has(exercise.id);
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => toggleExerciseSelection(exercise.id)}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left text-xs transition active:scale-[0.98] ${
                        selected
                          ? "border-accent bg-accent/10 text-ink"
                          : "border-line-strong text-ink-secondary hover:border-ink-muted"
                      }`}
                    >
                      <span className="truncate">{exercise.name}</span>
                      <Heart
                        size={14}
                        className={`shrink-0 ${selected ? "fill-accent text-accent" : "text-ink-muted"}`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(3)} className={skipClass}>
                  Skip this step
                </button>
                <button onClick={handleSaveFavorites} disabled={saving} className={primaryButtonClass}>
                  {selectedExerciseIds.size > 0
                    ? `Continue with ${selectedExerciseIds.size} favorite${selectedExerciseIds.size === 1 ? "" : "s"}`
                    : "Continue"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Generate your first split</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  A real, structured plan built from your stats, not a generic template.
                </p>
              </div>
              {!plan ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={daysPerWeek}
                      onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                      className={selectClass}
                    >
                      {[1, 2, 3, 4, 5, 6].map((d) => (
                        <option key={d} value={d}>
                          {d} days/wk
                        </option>
                      ))}
                    </select>
                    <select
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                      className={selectClass}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <select
                      value={goal}
                      onChange={(e) => setGoal(e.target.value as TrainingGoal)}
                      className={selectClass}
                    >
                      <option value="strength">Strength</option>
                      <option value="hypertrophy">Hypertrophy</option>
                      <option value="general_fitness">General fitness</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <button onClick={() => setStep(4)} className={skipClass}>
                      Skip this step
                    </button>
                    <button onClick={handleGenerateSplit} disabled={saving} className={primaryButtonClass}>
                      {saving ? "Generating..." : "Generate split"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-line-strong bg-bg p-3">
                    <p className="text-sm font-medium text-accent">{plan.split_type}</p>
                    {plan.days.map((day) => (
                      <div key={day.day_number}>
                        <p className="text-sm font-semibold">
                          Day {day.day_number}: {day.label}
                        </p>
                        <ul className="ml-4 list-disc text-xs text-ink-secondary">
                          {day.exercises.map((ex) => (
                            <li key={ex.exercise_id}>
                              {ex.name} &middot; {ex.sets}&times;{ex.reps}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => setStep(4)} className={primaryButtonClass}>
                      Continue
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Meet your AI coach</h1>
                <p className="mt-2 text-sm text-ink-secondary">
                  Your coach checks your real weight trend, macro targets, and training history
                  before it answers. Ask it for a split, your macros, or just how your week went,
                  it will ground its answer in your actual data instead of guessing.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => finish("/dashboard")} disabled={saving} className={skipClass}>
                  Go to dashboard instead
                </button>
                <button onClick={() => finish("/coach")} disabled={saving} className={primaryButtonClass}>
                  Go to Coach
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
