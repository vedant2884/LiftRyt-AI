import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { resetPassword } from "../api/auth";
import { FormField, inputClass } from "../components/FormField";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-bg px-4 text-ink">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-sm text-ink-secondary">
            This reset link is missing its token. Request a new one below.
          </p>
          <Link to="/forgot-password" className="text-accent hover:underline">
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token!, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail
        : undefined;
      setError(detail ?? "That reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-bg px-4 text-ink">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8"
      >
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
        {done ? (
          <p className="text-sm text-emerald-400">Password updated. Redirecting to log in...</p>
        ) : (
          <>
            <FormField label="New password" htmlFor="password">
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
            <FormField label="Confirm new password" htmlFor="confirm_password">
              <input
                id="confirm_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent py-2 font-medium text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? "Saving..." : "Reset password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
