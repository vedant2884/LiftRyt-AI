import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import WeightTrendCard from "../components/WeightTrendCard";
import WorkoutsSummaryCard from "../components/WorkoutsSummaryCard";
import { formatHeight, formatWeight } from "../lib/units";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  // ProtectedRoute guarantees user is set before this renders.
  if (!user) return null;

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">Welcome, {user.full_name}</h1>

        <Link
          to="/coach"
          className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 p-4 transition hover:border-accent"
        >
          <div>
            <p className="font-medium text-accent">Chat with your AI coach</p>
            <p className="text-xs text-ink-secondary">
              Grounded in your logged weight, workouts, and PRs
            </p>
          </div>
          <span className="text-accent">&rarr;</span>
        </Link>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <WeightTrendCard />
          <WorkoutsSummaryCard />
        </div>

        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Age</dt>
            <dd>{user.age}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Height</dt>
            <dd>{formatHeight(user.height_cm, user.unit_length)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Goal weight</dt>
            <dd>
              {user.goal_weight_kg ? formatWeight(user.goal_weight_kg, user.unit_weight) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Training experience</dt>
            <dd className="capitalize">{user.training_experience}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Activity level</dt>
            <dd className="capitalize">{user.activity_level.replace("_", " ")}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
