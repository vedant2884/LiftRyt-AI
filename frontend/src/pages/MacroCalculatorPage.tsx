import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { calculateMacros, fetchActiveMacroTarget, fetchMacroHistory } from "../api/macros";
import { Skeleton } from "../components/Skeleton";
import { getChartTheme } from "../lib/chartTheme";
import { toast } from "../store/toastStore";
import { useThemeStore } from "../store/themeStore";
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
  const mode = useThemeStore((s) => s.theme);
  const chart = getChartTheme(mode);

  const [active, setActive] = useState<MacroTarget | null>(null);
  const [history, setHistory] = useState<MacroTarget[]>([]);
  const [goal, setGoal] = useState<MacroGoal>("maintain");
  const [weightOverride, setWeightOverride] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [a, h] = await Promise.all([fetchActiveMacroTarget(), fetchMacroHistory()]);
    setActive(a);
    setHistory(h);
    if (a) setGoal(a.goal);
  }

  useEffect(() => {
    refresh().finally(() => setPageLoading(false));
  }, []);

  async function handleCalculate() {
    setError(null);
    setLoading(true);
    try {
      const result = await calculateMacros(goal, weightOverride ? Number(weightOverride) : undefined);
      setActive(result);
      setHistory((prev) => [result, ...prev.map((t) => ({ ...t, is_active: false }))]);
      toast.success("Macro targets updated");
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
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">Macro & Calorie Calculator</h1>

      <div className="mb-8 rounded-xl border border-line bg-surface p-4">
        <p className="mb-3 text-sm text-ink-secondary">Goal</p>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGoal(g.value)}
              className={`rounded-lg border p-3 text-left transition ${
                goal === g.value
                  ? "border-accent bg-accent/10"
                  : "border-line-strong hover:border-ink-muted"
              }`}
            >
              <p className="font-medium">{g.label}</p>
              <p className="text-xs text-ink-muted">{g.hint}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-ink-muted" htmlFor="weight-override">
              Weight override (kg, optional)
            </label>
            <input
              id="weight-override"
              type="number"
              step="0.1"
              placeholder="e.g. 82.5"
              value={weightOverride}
              onChange={(e) => setWeightOverride(e.target.value)}
              className="w-56 rounded-md border border-line-strong bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="text-xs text-ink-muted">
              Leave blank to use your latest logged weight.
            </p>
          </div>
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? "Calculating..." : "Calculate"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {pageLoading && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="mt-2 h-6 w-16" />
            </div>
          ))}
        </div>
      )}

      {!pageLoading && active && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-ink-muted">BMR</p>
              <p className="mt-1 text-xl font-semibold">{active.bmr}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-ink-muted">TDEE</p>
              <p className="mt-1 text-xl font-semibold">{active.tdee}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-accent/40 bg-accent/10 p-4">
              <p className="text-xs text-ink-secondary">Target calories</p>
              <p className="mt-1 text-2xl font-semibold text-accent">{active.target_calories} kcal</p>
            </div>
          </div>

          <div className="mb-8 rounded-xl border border-line bg-surface p-4">
            <p className="mb-3 text-sm font-medium text-ink-secondary">Macro split</p>
            <div className="mb-3 flex h-4 overflow-hidden rounded-full">
              <div
                style={{ width: `${(proteinKcal / totalKcal) * 100}%`, background: chart.seriesBlue }}
              />
              <div
                style={{ width: `${(carbsKcal / totalKcal) * 100}%`, background: chart.seriesOrange }}
              />
              <div style={{ width: `${(fatKcal / totalKcal) * 100}%`, background: chart.seriesAqua }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: chart.seriesBlue }} />
                <div>
                  <p className="font-medium">{active.target_protein_g}g</p>
                  <p className="text-xs text-ink-muted">Protein</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: chart.seriesOrange }} />
                <div>
                  <p className="font-medium">{active.target_carbs_g}g</p>
                  <p className="text-xs text-ink-muted">Carbs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: chart.seriesAqua }} />
                <div>
                  <p className="font-medium">{active.target_fat_g}g</p>
                  <p className="text-xs text-ink-muted">Fat</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {history.length > 1 && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink-secondary">History</p>
          <ul className="divide-y divide-line">
            {history.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize">
                  {t.goal} &middot; {t.target_calories} kcal
                </span>
                <span className="text-xs text-ink-muted">
                  {formatDate(t.created_at)}
                  {t.is_active && <span className="ml-2 text-accent">active</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
