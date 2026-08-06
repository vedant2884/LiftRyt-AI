import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout as logoutApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition ${
    isActive ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
  }`;

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutApi();
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="min-h-svh bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold tracking-tight">
              Lift<span className="text-violet-400">Ryt</span> AI
            </span>
            <nav className="flex items-center gap-1">
              <NavLink to="/dashboard" className={navLinkClass} end>
                Dashboard
              </NavLink>
              <NavLink to="/coach" className={navLinkClass}>
                Coach
              </NavLink>
              <NavLink to="/weight" className={navLinkClass}>
                Weight
              </NavLink>
              <NavLink to="/workouts" className={navLinkClass}>
                Workouts
              </NavLink>
              <NavLink to="/exercises" className={navLinkClass}>
                Exercises
              </NavLink>
              <NavLink to="/macros" className={navLinkClass}>
                Macros
              </NavLink>
              <NavLink to="/splits" className={navLinkClass}>
                Splits
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="text-sm text-neutral-500">{user.full_name}</span>}
            <button
              onClick={handleLogout}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm transition hover:bg-neutral-800"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
