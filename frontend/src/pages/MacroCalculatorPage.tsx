import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { calculateMacros, fetchActiveMacroTarget, fetchMacroHistory } from "../api/macros";
import { seriesAqua, seriesBlue, seriesOrange } from "../lib/chartTheme";
import type { MacroGoal, MacroTarget } from "../types/macro";

const GOALS: { value: MacroGoal; label: string; hint: string }[] = [
  { value: "cut", label: "Cut", hint: "Calorie deficit to lose fat" },
  { value: "maintain", label: "Maintain", hint: "Stay at current weight" },
  { value: "bulk", label: "Bulk", hint: "Calorie surplus to build muscle" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MacroCalculatorPage() {
  const [active, setActive] = useState<MacroTarget | null>(null);
  const [history, setHistory] = useState<MacroTarget[]>([]);
  const [goal, setGoal] = useState<MacroGoal>("maintain");
  const [weightOverride, setWeightOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [a, h] = await Promise.all([fetchActiveMacroTarget(), fetchMacroHistory()]);
    setActive(a);
    setHistory(h);
    if (a) setGoal(a.goal);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCalculate() {
    setError(null);
    setLoading(true);
    try {
      const result = await calculateMacros(goal, weightOverride ? Number(weightOverride) : undefined);
      setActive(result);
      setHistory((prev) => [result, ...prev.map((t) => ({ ...t, is_active: false }))]);
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail : undefined;
      setError(detail ?? "Failed to calculate. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const proteinKcal = active ? active.target_protein_g * 4 : 0;
  const carbsKcal = active ? active.target_carbs_g * 4 : 0;
  const fatKcal = active ? active.target_fat_g * 9 : 0;
  const totalKcal = proteinKcal + carbsKcal + fatKcal || 1;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Macro & Calorie Calculator</h1>

      <div className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="mb-3 text-sm text-neutral-400">Goal</p>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGoal(g.value)}
              className={`rounded-lg border p-3 text-left transition ${
                goal === g.value
                  ? "border-violet-400 bg-violet-500/10"
                  : "border-neutral-700 hover:border-neutral-600"
              }`}
            >
              <p className="font-medium">{g.label}</p>
              <p className="text-xs text-neutral-500">{g.hint}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-neutral-500" htmlFor="weight-override">
              Weight override (kg, optional)
            </label>
            <input
              id="weight-override"
              type="number"
              step="0.1"
              placeholder="uses latest logged weight"
              value={weightOverride}
              onChange={(e) => setWeightOverride(e.target.value)}
              className="w-56 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="rounded-md bg-violet-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
          >
            {loading ? "Calculating..." : "Calculate"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {active && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <p className="text-xs text-neutral-500">BMR</p>
              <p className="mt-1 text-xl font-semibold">{active.bmr}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <p className="text-xs text-neutral-500">TDEE</p>
              <p className="mt-1 text-xl font-semibold">{active.tdee}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-violet-400/40 bg-violet-500/10 p-4">
              <p className="text-xs text-neutral-400">Target calories</p>
              <p className="mt-1 text-2xl font-semibold text-violet-300">
                {active.target_calories} kcal
              </p>
            </div>
          </div>

          <div className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="mb-3 text-sm font-medium text-neutral-300">Macro split</p>
            <div className="mb-3 flex h-4 overflow-hidden rounded-full">
              <div
                style={{ width: `${(proteinKcal / totalKcal) * 100}%`, background: seriesBlue }}
              />
              <div
                style={{ width: `${(carbsKcal / totalKcal) * 100}%`, background: seriesOrange }}
              />
              <div style={{ width: `${(fatKcal / totalKcal) * 100}%`, background: seriesAqua }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: seriesBlue }} />
                <div>
                  <p className="font-medium">{active.target_protein_g}g</p>
                  <p className="text-xs text-neutral-500">Protein</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: seriesOrange }} />
                <div>
                  <p className="font-medium">{active.target_carbs_g}g</p>
                  <p className="text-xs text-neutral-500">Carbs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: seriesAqua }} />
                <div>
                  <p className="font-medium">{active.target_fat_g}g</p>
                  <p className="text-xs text-neutral-500">Fat</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {history.length > 1 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-3 text-sm font-medium text-neutral-300">History</p>
          <ul className="divide-y divide-neutral-800">
            {history.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize">
                  {t.goal} &middot; {t.target_calories} kcal
                </span>
                <span className="text-xs text-neutral-500">
                  {formatDate(t.created_at)}
                  {t.is_active && <span className="ml-2 text-violet-400">active</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
