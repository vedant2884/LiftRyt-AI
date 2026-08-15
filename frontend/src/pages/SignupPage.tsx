import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { signup } from "../api/auth";
import { useAuthBackgroundStyle } from "../lib/authBackground";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { FormField, inputClass } from "../components/FormField";
import GoogleSignInButton from "../components/GoogleSignInButton";
import type { GoogleAuthResponse } from "../types/auth";
import type { ActivityLevel, DietaryPreference, ExperienceLevel, Sex } from "../types/user";

const selectClass = inputClass;

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const backgroundStyle = useAuthBackgroundStyle();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [heightCm, setHeightCm] = useState("");
  const [startingWeightKg, setStartingWeightKg] = useState("");
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [trainingExperience, setTrainingExperience] = useState<ExperienceLevel>("beginner");
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>("none");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token, user } = await signup({
        email,
        password,
        full_name: fullName,
        username,
        age: Number(age),
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
      setError(typeof detail === "string" ? detail : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleResult(result: GoogleAuthResponse) {
    if (result.needs_profile) {
      navigate("/signup/complete", {
        state: {
          google_token: result.google_token,
          email: result.email,
          full_name: result.full_name,
          avatar_url: result.avatar_url,
        },
      });
      return;
    }
    if (result.access_token && result.user) {
      setAuth(result.access_token, result.user);
      useThemeStore.getState().setTheme(result.user.theme);
      useThemeStore.getState().setAccentColor(result.user.accent_color);
      navigate("/dashboard");
    }
  }

  return (
    <main
      className="flex min-h-svh items-center justify-center px-4 py-10 text-ink"
      style={backgroundStyle}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-xl border border-line bg-surface p-8"
      >
        <h1 className="text-2xl font-semibold">Create your account</h1>
        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <GoogleSignInButton onResult={handleGoogleResult} onError={setError} />
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <div className="h-px flex-1 bg-line" />
          or sign up with email
          <div className="h-px flex-1 bg-line" />
        </div>

        <FormField label="Full name" htmlFor="full_name">
          <input
            id="full_name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </FormField>

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

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Age" htmlFor="age">
            <input
              id="age"
              type="number"
              required
              min={13}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Sex" htmlFor="sex">
            <select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
              className={selectClass}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
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
            <select
              id="activity_level"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className={selectClass}
            >
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very active</option>
            </select>
          </FormField>
          <FormField label="Training experience" htmlFor="training_experience">
            <select
              id="training_experience"
              value={trainingExperience}
              onChange={(e) => setTrainingExperience(e.target.value as ExperienceLevel)}
              className={selectClass}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </FormField>
          <FormField label="Diet" htmlFor="dietary_preference">
            <select
              id="dietary_preference"
              value={dietaryPreference}
              onChange={(e) => setDietaryPreference(e.target.value as DietaryPreference)}
              className={selectClass}
            >
              <option value="none">None</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="pescatarian">Pescatarian</option>
              <option value="keto">Keto</option>
              <option value="other">Other</option>
            </select>
          </FormField>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent py-2 font-medium text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
        <p className="text-center text-sm text-ink-secondary">
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
