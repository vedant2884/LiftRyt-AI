import { useAuthStore } from "../store/authStore";
import WeightTrendCard from "../components/WeightTrendCard";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  // ProtectedRoute guarantees user is set before this renders.
  if (!user) return null;

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">Welcome, {user.full_name}</h1>

        <WeightTrendCard />

        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-neutral-500">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Age</dt>
            <dd>{user.age}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Height</dt>
            <dd>{user.height_cm} cm</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Goal weight</dt>
            <dd>{user.goal_weight_kg ? `${user.goal_weight_kg} kg` : "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Training experience</dt>
            <dd className="capitalize">{user.training_experience}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Activity level</dt>
            <dd className="capitalize">{user.activity_level.replace("_", " ")}</dd>
          </div>
        </dl>

        <p className="text-sm text-neutral-500">
          Workout logging and the AI coach land in upcoming steps.
        </p>
      </div>
    </main>
  );
}
