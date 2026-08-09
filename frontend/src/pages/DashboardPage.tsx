import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import StreaksCards from "../components/StreaksCards";
import WeightTrendCard from "../components/WeightTrendCard";
import { formatHeight, formatWeight } from "../lib/units";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  // ProtectedRoute guarantees user is set before this renders.
  if (!user) return null;

  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="mb-2 text-2xl font-semibold">Welcome, {user.full_name}</h1>

        <Link
          to="/coach"
          className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 p-5 transition hover:border-accent"
        >
          <div>
            <p className="text-xs text-accent">Chat with your AI coach</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Grounded in your logged weight and macro targets
            </p>
          </div>
          <span className="text-accent">&rarr;</span>
        </Link>

        <WeightTrendCard />

        <StreaksCards />

        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="mb-3 text-xs text-ink-muted">Your profile</p>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd className="mt-0.5">{user.email}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Age</dt>
              <dd className="mt-0.5">{user.age}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Height</dt>
              <dd className="mt-0.5">{formatHeight(user.height_cm, user.unit_length)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Goal weight</dt>
              <dd className="mt-0.5">
                {user.goal_weight_kg ? (
                  formatWeight(user.goal_weight_kg, user.unit_weight)
                ) : (
                  <Link to="/profile" className="text-accent hover:underline">
                    Set in profile
                  </Link>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Training experience</dt>
              <dd className="mt-0.5 capitalize">{user.training_experience}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Activity level</dt>
              <dd className="mt-0.5 capitalize">{user.activity_level.replace("_", " ")}</dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}
