import { NavLink, Outlet } from "react-router-dom";
import { Dumbbell, LineChart } from "lucide-react";

const TABS = [
  { to: "/workouts", label: "Log", icon: Dumbbell, end: true },
  { to: "/workouts/analysis", label: "Analysis", icon: LineChart },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center gap-2 whitespace-nowrap px-1 py-3 text-sm font-medium transition-colors ${
    isActive ? "text-ink" : "text-ink-muted hover:text-ink-secondary"
  }`;

/** Shared sub-nav for the Workouts section — same underline-tab pattern as
 * LibraryLayout, so "Log" and "Analysis" read as one product area rather
 * than a top-nav item plus an unrelated page. Deliberately not wrapping
 * /workouts/active or /workouts/:id — a live logging session or a single
 * workout's detail view shouldn't show analysis tabs. */
export default function WorkoutsLayout() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Workouts</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Open, log your sets, finish, and see how your training is actually trending.
        </p>
      </div>

      <nav className="mb-8 flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={2} className={isActive ? "text-accent" : ""} />
                  {tab.label}
                  <span
                    className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-opacity ${
                      isActive ? "bg-accent opacity-100" : "opacity-0"
                    }`}
                  />
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </main>
  );
}
