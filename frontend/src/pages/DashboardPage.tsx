import { useNavigate } from "react-router-dom";
import { logout as logoutApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutApi();
    clearAuth();
    navigate("/login");
  }

  // ProtectedRoute guarantees user is set before this renders.
  if (!user) return null;

  return (
    <main className="min-h-svh bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Welcome, {user.full_name}</h1>
          <button
            onClick={handleLogout}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm transition hover:bg-neutral-800"
          >
            Log out
          </button>
        </div>

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
          Weight tracking, workout logging, and the AI coach land in upcoming steps.
        </p>
      </div>
    </main>
  );
}
