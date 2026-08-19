import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Monitor, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { changePassword, deleteAccount, updateProfile, uploadAvatarFile, type ProfileUpdatePayload } from "../api/auth";
import { initials, resolveAvatarUrl } from "../lib/avatar";
import { toast } from "../store/toastStore";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { FormField, inputClass } from "../components/FormField";
import { INCREMENT_PRESETS_KG } from "../types/progression";
import type { AccentColor, LengthUnit, ThemeMode, WeightUnit } from "../types/user";

const ACCENTS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: "violet", label: "Violet", swatch: "#8b5cf6" },
  { value: "emerald", label: "Emerald", swatch: "#10b981" },
];

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { theme, accentColor, setTheme, setAccentColor } = useThemeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [workoutRemindersEnabled, setWorkoutRemindersEnabled] = useState(
    user?.workout_reminders_enabled ?? true,
  );
  const [unitWeight, setUnitWeight] = useState<WeightUnit>(user?.unit_weight ?? "kg");
  const [unitLength, setUnitLength] = useState<LengthUnit>(user?.unit_length ?? "cm");
  const [increment, setIncrement] = useState(user?.default_progression_increment_kg ?? 2.5);
  const [customIncrementInput, setCustomIncrementInput] = useState("");
  const isCustomIncrement = !(INCREMENT_PRESETS_KG as readonly number[]).includes(increment);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [editingIdentity, setEditingIdentity] = useState(false);
  const [fullNameDraft, setFullNameDraft] = useState(user?.full_name ?? "");
  const [usernameDraft, setUsernameDraft] = useState(user?.username ?? "");
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user ? resolveAvatarUrl(user) : null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  if (user && avatarUrl !== resolveAvatarUrl(user)) {
    // Resync when the resolved URL changes (a new upload, or a fresh Google
    // picture from a re-login) and clear any previous broken-image state —
    // the new URL deserves its own attempt to load, not the old one's fate.
    setAvatarUrl(resolveAvatarUrl(user));
    setAvatarBroken(false);
  }

  const [editingGoalWeight, setEditingGoalWeight] = useState(false);
  const [goalWeightDraft, setGoalWeightDraft] = useState(String(user?.goal_weight_kg ?? ""));
  const [goalWeightError, setGoalWeightError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) return null;

  async function persist(changes: ProfileUpdatePayload) {
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

  function startEditingIdentity() {
    setFullNameDraft(user!.full_name);
    setUsernameDraft(user!.username);
    setIdentityError(null);
    setEditingIdentity(true);
  }

  async function saveIdentity() {
    setIdentityError(null);
    try {
      const updated = await updateProfile({
        full_name: fullNameDraft,
        username: usernameDraft,
      });
      if (accessToken) setAuth(accessToken, updated);
      setEditingIdentity(false);
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail
        : undefined;
      setIdentityError(typeof detail === "string" ? detail : "Couldn't save changes");
    }
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarUploading(true);
    setIdentityError(null);
    try {
      // One authenticated round trip to our own backend — it saves the file
      // and returns the already-updated profile, so this is the only place
      // that needs to sync local state (no separate PATCH afterward).
      const updated = await uploadAvatarFile(file);
      if (accessToken) setAuth(accessToken, updated);
      toast.success("Profile picture updated");
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail : undefined;
      const message = typeof detail === "string" ? detail : "Couldn't upload that picture. Please try again.";
      setIdentityError(message);
      toast.error(message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveGoalWeight() {
    setGoalWeightError(null);
    const value = Number(goalWeightDraft);
    if (!value || value <= 0) {
      setGoalWeightError("Enter a valid weight.");
      return;
    }
    try {
      const updated = await updateProfile({ goal_weight_kg: value });
      if (accessToken) setAuth(accessToken, updated);
      setEditingGoalWeight(false);
    } catch {
      setGoalWeightError("Couldn't save your goal weight.");
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail
        : undefined;
      setPasswordError(typeof detail === "string" ? detail : "Couldn't change your password.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      clearAuth();
      navigate("/");
    } catch {
      setDeleteError("Couldn't delete your account. Please try again.");
      setDeleting(false);
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

  function handleWorkoutRemindersChange(enabled: boolean) {
    setWorkoutRemindersEnabled(enabled);
    persist({ workout_reminders_enabled: enabled });
  }

  function handleIncrementSelectChange(value: string) {
    if (value === "custom") {
      setCustomIncrementInput(String(increment));
      return;
    }
    const num = Number(value);
    setIncrement(num);
    persist({ default_progression_increment_kg: num });
  }

  function handleCustomIncrementSubmit() {
    const num = Number(customIncrementInput);
    if (!num || num <= 0) return;
    setIncrement(num);
    persist({ default_progression_increment_kg: num });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profile</h1>
        {saving && <span className="text-xs text-ink-muted">Saving...</span>}
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border border-line bg-surface p-5">
          {identityError && !editingIdentity && (
            <p className="mb-3 text-xs text-red-400">{identityError}</p>
          )}
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-line-strong bg-bg disabled:opacity-60"
              aria-label="Change profile picture"
            >
              {avatarUrl && !avatarBroken ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-accent/15 text-xl font-semibold text-accent">
                  {initials(user.full_name)}
                </span>
              )}
              {avatarUploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                Change
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <div className="min-w-0 flex-1">
              {editingIdentity ? (
                <div className="space-y-2">
                  <input
                    value={fullNameDraft}
                    onChange={(e) => setFullNameDraft(e.target.value)}
                    placeholder="Full name"
                    className={inputClass}
                  />
                  <input
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    placeholder="username"
                    pattern="^[a-zA-Z0-9_]{3,30}$"
                    title="3-30 characters: letters, numbers, underscores"
                    className={inputClass}
                  />
                  {identityError && <p className="text-xs text-red-400">{identityError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveIdentity}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingIdentity(false)}
                      className="rounded-md border border-line-strong px-3 py-1.5 text-xs transition hover:bg-surface-hover active:scale-[0.97]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="truncate text-lg font-semibold">{user.full_name}</p>
                  <p className="truncate text-sm text-ink-secondary">@{user.username}</p>
                  <p className="truncate text-xs text-ink-muted">{user.email}</p>
                  <button
                    type="button"
                    onClick={startEditingIdentity}
                    className="mt-2 rounded-md border border-line-strong px-3 py-1.5 text-xs transition hover:bg-surface-hover active:scale-[0.97]"
                  >
                    Edit profile
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-medium">Training goal</h2>
          <p className="mb-3 text-sm text-ink-muted">
            The coach and your dashboard are grounded in this number.
          </p>
          {editingGoalWeight ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label className="text-xs text-ink-secondary" htmlFor="goal_weight_kg">
                  Goal weight (kg)
                </label>
                <input
                  id="goal_weight_kg"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={1}
                  max={500}
                  value={goalWeightDraft}
                  onChange={(e) => setGoalWeightDraft(e.target.value)}
                  className={`${inputClass} w-32`}
                />
              </div>
              <button
                type="button"
                onClick={saveGoalWeight}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingGoalWeight(false);
                  setGoalWeightError(null);
                }}
                className="rounded-md border border-line-strong px-3 py-1.5 text-xs transition hover:bg-surface-hover active:scale-[0.97]"
              >
                Cancel
              </button>
              {goalWeightError && <p className="w-full text-xs text-red-400">{goalWeightError}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">
                {user.goal_weight_kg ? `${user.goal_weight_kg} kg` : "Not set"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setGoalWeightDraft(String(user.goal_weight_kg ?? ""));
                  setGoalWeightError(null);
                  setEditingGoalWeight(true);
                }}
                className="rounded-md border border-line-strong px-3 py-1.5 text-xs transition hover:bg-surface-hover active:scale-[0.97]"
              >
                {user.goal_weight_kg ? "Edit" : "Set goal weight"}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-medium">Appearance</h2>
          <p className="mb-4 text-sm text-ink-muted">Choose a mode and an accent color.</p>

          <p className="mb-2 text-xs text-ink-secondary">Mode</p>
          <div className="mb-5 inline-flex rounded-lg border border-line bg-bg p-1">
            {(["dark", "light", "system"] as ThemeMode[]).map((mode) => {
              const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
              return (
                <button
                  key={mode}
                  onClick={() => handleThemeChange(mode)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm capitalize transition ${
                    theme === mode ? "bg-accent text-on-accent" : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {mode}
                </button>
              );
            })}
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
          <h2 className="mb-1 font-medium">Notifications</h2>
          <p className="mb-4 text-sm text-ink-muted">
            Occasional, behavior-based nudges — a streak reminder, a gentle check-in if you usually
            train today. Never more than one at a time.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Workout reminders</span>
            <div className="inline-flex rounded-lg border border-line bg-bg p-1">
              <button
                type="button"
                onClick={() => handleWorkoutRemindersChange(true)}
                className={`rounded-md px-4 py-1.5 text-sm transition ${
                  workoutRemindersEnabled ? "bg-accent text-on-accent" : "text-ink-secondary hover:text-ink"
                }`}
              >
                On
              </button>
              <button
                type="button"
                onClick={() => handleWorkoutRemindersChange(false)}
                className={`rounded-md px-4 py-1.5 text-sm transition ${
                  !workoutRemindersEnabled ? "bg-accent text-on-accent" : "text-ink-secondary hover:text-ink"
                }`}
              >
                Off
              </button>
            </div>
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

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-medium">Progressive overload</h2>
          <p className="mb-4 text-sm text-ink-muted">
            After a PR, the coach offers to suggest this weight bump for next time — always your call to
            confirm, per exercise. This is just the default; override it per exercise from its Library
            detail page.
          </p>
          <p className="mb-2 text-xs text-ink-secondary">Default weight increase</p>
          <div className="flex items-center gap-2">
            <select
              value={isCustomIncrement ? "custom" : String(increment)}
              onChange={(e) => handleIncrementSelectChange(e.target.value)}
              className={`${inputClass} w-32`}
            >
              {INCREMENT_PRESETS_KG.map((kg) => (
                <option key={kg} value={kg}>
                  {kg} kg
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {isCustomIncrement && (
              <>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={customIncrementInput}
                  onChange={(e) => setCustomIncrementInput(e.target.value)}
                  placeholder="kg"
                  className={`${inputClass} w-24`}
                />
                <button
                  type="button"
                  onClick={handleCustomIncrementSubmit}
                  className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
                >
                  Save
                </button>
              </>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-medium">Password</h2>
          {user.has_password ? (
            <>
              <p className="mb-4 text-sm text-ink-muted">Change the password you use to log in.</p>
              <form onSubmit={handleChangePassword} className="max-w-sm space-y-3">
                <FormField label="Current password" htmlFor="current_password">
                  <input
                    id="current_password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="New password" htmlFor="new_password">
                  <input
                    id="new_password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
                {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                {passwordSaved && <p className="text-xs text-emerald-400">Password changed.</p>}
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                >
                  {changingPassword ? "Saving..." : "Change password"}
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              This account signs in with Google and has no password to change.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-red-500/30 bg-surface p-5">
          <h2 className="mb-1 font-medium text-red-400">Delete account</h2>
          <p className="mb-4 text-sm text-ink-muted">
            Permanently deletes your account and all logged data. This can't be undone.
          </p>
          {confirmingDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-ink">Are you sure? This can't be undone.</p>
              {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                >
                  {deleting ? "Deleting..." : "Yes, delete my account"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs transition hover:bg-surface-hover active:scale-[0.97]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
            >
              Delete account
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
