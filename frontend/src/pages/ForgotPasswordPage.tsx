import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import { FormField, inputClass } from "../components/FormField";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setDevResetLink(result.dev_reset_link);
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-bg px-4 text-ink">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8">
        <h1 className="text-2xl font-semibold">Reset your password</h1>

        {sent ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-secondary">
              If an account exists for {email}, a reset link has been sent. Check your inbox.
            </p>
            {devResetLink && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                <p className="mb-1 font-medium text-amber-400">Dev mode: no email provider is configured</p>
                <p className="text-ink-secondary">This link would normally be emailed to you.</p>
                <Link to={devResetLink.replace(window.location.origin, "")} className="mt-1 block break-all text-accent hover:underline">
                  {devResetLink}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-ink-secondary">
              Enter the email on your account and we will send you a link to reset your password.
            </p>
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent py-2 font-medium text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-ink-secondary">
          <Link to="/login" className="text-accent hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
