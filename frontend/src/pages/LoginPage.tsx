import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { login } from "../api/auth";
import { useAuthBackgroundStyle } from "../lib/authBackground";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { FormField, inputClass } from "../components/FormField";
import GoogleSignInButton from "../components/GoogleSignInButton";
import type { GoogleAuthResponse } from "../types/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const backgroundStyle = useAuthBackgroundStyle();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token, user } = await login(email, password);
      setAuth(access_token, user);
      useThemeStore.getState().setTheme(user.theme);
      useThemeStore.getState().setAccentColor(user.accent_color);
      navigate("/dashboard");
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail
        : undefined;
      setError(detail ?? "Login failed");
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
      className="flex min-h-svh items-center justify-center px-4 text-ink"
      style={backgroundStyle}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8"
      >
        <h1 className="text-2xl font-semibold">Log in</h1>
        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-xs text-ink-secondary hover:text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent py-2 font-medium text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <div className="h-px flex-1 bg-line" />
          or
          <div className="h-px flex-1 bg-line" />
        </div>
        <GoogleSignInButton onResult={handleGoogleResult} onError={setError} />

        <p className="text-center text-sm text-ink-secondary">
          No account?{" "}
          <Link to="/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
