import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type HealthStatus = "checking" | "ok" | "error";

export default function HomePage() {
  const [status, setStatus] = useState<HealthStatus>("checking");

  useEffect(() => {
    api
      .get("/health")
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, []);

  const statusColor =
    status === "ok" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-amber-400";

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-neutral-950 px-6 text-neutral-100">
      <h1 className="text-4xl font-semibold tracking-tight">
        Lift<span className="text-violet-400">Ryt</span> AI
      </h1>
      <p className="max-w-md text-center text-neutral-400">
        Your AI gym coach — weight tracking, workout logging, and training
        guidance backed by your real history.
      </p>
      <div className="flex gap-3">
        <Link
          to="/signup"
          className="rounded-md bg-violet-500 px-5 py-2 font-medium text-white transition hover:bg-violet-400"
        >
          Get started
        </Link>
        <Link
          to="/login"
          className="rounded-md border border-neutral-700 px-5 py-2 font-medium transition hover:bg-neutral-800"
        >
          Log in
        </Link>
      </div>
      <div className="mt-6 flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs text-neutral-500">
        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
        backend {status === "checking" ? "checking..." : status}
      </div>
    </main>
  );
}
