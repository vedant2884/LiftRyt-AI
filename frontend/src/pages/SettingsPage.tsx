import { useState } from "react";
import { updateProfile } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import type { AccentColor, LengthUnit, ThemeMode, WeightUnit } from "../types/user";

const ACCENTS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: "violet", label: "Violet", swatch: "#8b5cf6" },
  { value: "emerald", label: "Emerald", swatch: "#10b981" },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { theme, accentColor, setTheme, setAccentColor } = useThemeStore();
  const [unitWeight, setUnitWeight] = useState<WeightUnit>(user?.unit_weight ?? "kg");
  const [unitLength, setUnitLength] = useState<LengthUnit>(user?.unit_length ?? "cm");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  async function persist(changes: Partial<Record<string, string>>) {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateProfile(changes);
      if (accessToken) setAuth(accessToken, updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  function handleThemeChange(mode: ThemeMode) {
    setTheme(mode);
    persist({ theme: mode });
  }

  function handleAccentChange(accent: AccentColor) {
    setAccentColor(accent);
    persist({ accent_color: accent });
  }

  function handleUnitWeightChange(unit: WeightUnit) {
    setUnitWeight(unit);
    persist({ unit_weight: unit });
  }

  function handleUnitLengthChange(unit: LengthUnit) {
    setUnitLength(unit);
    persist({ unit_length: unit });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        {saving && <span className="text-xs text-ink-muted">Saving...</span>}
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-medium">Appearance</h2>
          <p className="mb-4 text-sm text-ink-muted">Choose a mode and an accent color.</p>

          <p className="mb-2 text-xs text-ink-secondary">Mode</p>
          <div className="mb-5 inline-flex rounded-lg border border-line bg-bg p-1">
            {(["dark", "light"] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleThemeChange(mode)}
                className={`rounded-md px-4 py-1.5 text-sm capitalize transition ${
                  theme === mode ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs text-ink-secondary">Accent</p>
          <div className="flex gap-3">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                onClick={() => handleAccentChange(a.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  accentColor === a.value ? "border-accent" : "border-line hover:border-line-strong"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: a.swatch }}
                  aria-hidden
                />
                {a.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-medium">Units</h2>
          <p className="mb-4 text-sm text-ink-muted">
            Applied to weight and height displays throughout the app.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="mb-2 text-xs text-ink-secondary">Weight</p>
              <div className="inline-flex rounded-lg border border-line bg-bg p-1">
                {(["kg", "lb"] as WeightUnit[]).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => handleUnitWeightChange(unit)}
                    className={`rounded-md px-4 py-1.5 text-sm uppercase transition ${
                      unitWeight === unit ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-ink-secondary">Height</p>
              <div className="inline-flex rounded-lg border border-line bg-bg p-1">
                {(["cm", "in"] as LengthUnit[]).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => handleUnitLengthChange(unit)}
                    className={`rounded-md px-4 py-1.5 text-sm uppercase transition ${
                      unitLength === unit ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
