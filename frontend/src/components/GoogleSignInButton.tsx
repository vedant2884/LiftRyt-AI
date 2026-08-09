import { useState } from "react";
import { isAxiosError } from "axios";
import { googleAuth } from "../api/auth";
import { signInWithGoogle } from "../lib/firebase";
import type { GoogleAuthResponse } from "../types/auth";

interface GoogleSignInButtonProps {
  onResult: (result: GoogleAuthResponse) => void;
  onError: (message: string) => void;
}

export default function GoogleSignInButton({ onResult, onError }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const result = await googleAuth(idToken);
      onResult(result);
    } catch (err) {
      // Popup closed by the user isn't a real error worth surfacing.
      if (isAxiosError<{ detail?: string }>(err)) {
        onError(err.response?.data?.detail ?? "Google sign-in failed");
      } else if (err instanceof Error && err.message.includes("popup-closed-by-user")) {
        // no-op
      } else {
        onError("Google sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-line-strong bg-surface py-2 text-sm font-medium transition hover:bg-surface-hover disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.66Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3a7.15 7.15 0 0 1-10.66-3.76H1.4v3.1A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.4 14.34a7.2 7.2 0 0 1 0-4.68v-3.1H1.4a12 12 0 0 0 0 10.88l4-3.1Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.4 6.56l4 3.1A7.15 7.15 0 0 1 12 4.75Z"
        />
      </svg>
      {loading ? "Connecting..." : "Continue with Google"}
    </button>
  );
}
