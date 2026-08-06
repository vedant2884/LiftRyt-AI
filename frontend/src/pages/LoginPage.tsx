import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { login } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { FormField, inputClass } from "../components/FormField";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
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

  return (
    <main className="flex min-h-svh items-center justify-center bg-neutral-950 px-4 text-neutral-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-8"
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
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-violet-500 py-2 font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
        <p className="text-center text-sm text-neutral-400">
          No account?{" "}
          <Link to="/signup" className="text-violet-400 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
