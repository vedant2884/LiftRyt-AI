import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { signup } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { FormField, inputClass } from "../components/FormField";
import type { ActivityLevel, DietaryPreference, ExperienceLevel, Sex } from "../types/user";

const selectClass = inputClass;

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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
        age: Number(age),
        sex,
        height_cm: Number(heightCm),
        starting_weight_kg: startingWeightKg ? Number(startingWeightKg) : undefined,
        goal_weight_kg: goalWeightKg ? Number(goalWeightKg) : undefined,
        activity_level: activityLevel,
        training_experience: trainingExperience,
        dietary_preference: dietaryPreference,
      });
      setAuth(access_token, user);
      useThemeStore.getState().setTheme(user.theme);
      useThemeStore.getState().setAccentColor(user.accent_color);
      navigate("/dashboard");
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail
        : undefined;
      setError(typeof detail === "string" ? detail : "Signup failed");
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
        <h1 className="text-2xl font-semibold">Create your account</h1>
        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <FormField label="Full name" htmlFor="full_name">
          <input
            id="full_name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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
              min={1}
              max={500}
              value={startingWeightKg}
              onChange={(e) => setStartingWeightKg(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Goal weight (kg, optional)" htmlFor="goal_weight_kg">
            <input
              id="goal_weight_kg"
              type="number"
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
          className="w-full rounded-md bg-accent py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
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
