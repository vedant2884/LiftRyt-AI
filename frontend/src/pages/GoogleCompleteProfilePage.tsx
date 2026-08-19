import { type FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { googleCompleteProfile } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { FormField, inputClass } from "../components/FormField";
import { Select } from "../components/Select";
import { calculateAge, MAX_DATE_OF_BIRTH } from "../lib/age";
import type { ActivityLevel, DietaryPreference, ExperienceLevel, Sex } from "../types/user";

interface LocationState {
  google_token: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

export default function GoogleCompleteProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const state = location.state as LocationState | null;

  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [heightCm, setHeightCm] = useState("");
  const [startingWeightKg, setStartingWeightKg] = useState("");
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [trainingExperience, setTrainingExperience] = useState<ExperienceLevel>("beginner");
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>("none");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reaching this page requires a google_token from the /auth/google step —
  // direct navigation here (bookmark, refresh) has nothing to complete.
  if (!state?.google_token) {
    return <Navigate to="/signup" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token, user } = await googleCompleteProfile({
        google_token: state!.google_token,
        username,
        date_of_birth: dateOfBirth,
        sex,
        height_cm: Number(heightCm),
        starting_weight_kg: startingWeightKg ? Number(startingWeightKg) : undefined,
        goal_weight_kg: Number(goalWeightKg),
        activity_level: activityLevel,
        training_experience: trainingExperience,
        dietary_preference: dietaryPreference,
      });
      setAuth(access_token, user);
      useThemeStore.getState().setTheme(user.theme);
      useThemeStore.getState().setAccentColor(user.accent_color);
      navigate("/onboarding");
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail
        : undefined;
      setError(typeof detail === "string" ? detail : "Couldn't finish setting up your account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-bg px-4 py-10 text-ink">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-xl border border-line bg-surface p-8"
      >
        <div>
          <h1 className="text-2xl font-semibold">Almost there, {state.full_name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Signed in as {state.email}. Just a few details so the coach can calculate your targets.
          </p>
        </div>
        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <FormField label="Username" htmlFor="username">
          <input
            id="username"
            required
            pattern="^[a-zA-Z0-9_]{3,30}$"
            title="3-30 characters: letters, numbers, underscores"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Date of birth" htmlFor="date_of_birth">
            <input
              id="date_of_birth"
              type="date"
              required
              max={MAX_DATE_OF_BIRTH}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={inputClass}
            />
            {dateOfBirth && (
              <p className="mt-1 text-xs text-ink-muted">Age: {calculateAge(dateOfBirth)}</p>
            )}
          </FormField>
          <FormField label="Sex" htmlFor="sex">
            <Select id="sex" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </FormField>
          <FormField label="Height (cm)" htmlFor="height_cm">
            <input
              id="height_cm"
              type="number"
              required
              min={1}
              max={300}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Current weight (kg, optional)" htmlFor="starting_weight_kg">
            <input
              id="starting_weight_kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={1}
              max={500}
              value={startingWeightKg}
              onChange={(e) => setStartingWeightKg(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Goal weight (kg)" htmlFor="goal_weight_kg">
            <input
              id="goal_weight_kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              required
              min={1}
              max={500}
              value={goalWeightKg}
              onChange={(e) => setGoalWeightKg(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Activity level" htmlFor="activity_level">
            <Select
              id="activity_level"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
            >
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very active</option>
            </Select>
          </FormField>
          <FormField label="Training experience" htmlFor="training_experience">
            <Select
              id="training_experience"
              value={trainingExperience}
              onChange={(e) => setTrainingExperience(e.target.value as ExperienceLevel)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </FormField>
          <FormField label="Diet" htmlFor="dietary_preference">
            <Select
              id="dietary_preference"
              value={dietaryPreference}
              onChange={(e) => setDietaryPreference(e.target.value as DietaryPreference)}
            >
              <option value="none">None</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="non_vegetarian">Non-Vegetarian</option>
              <option value="eggetarian">Eggetarian</option>
              <option value="keto">Keto</option>
              <option value="other">Other</option>
            </Select>
          </FormField>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent py-2 font-medium text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? "Creating account..." : "Finish creating account"}
        </button>
      </form>
    </main>
  );
}
