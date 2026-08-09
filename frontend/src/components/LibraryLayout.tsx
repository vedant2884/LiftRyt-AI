import { NavLink, Outlet } from "react-router-dom";
import { Heart, Library as LibraryIcon, Sparkles, Wrench } from "lucide-react";

const TABS = [
  { to: "/library", label: "Exercise Library", icon: LibraryIcon, end: true },
  { to: "/library/favorites", label: "Favorites", icon: Heart },
  { to: "/library/custom", label: "Custom", icon: Wrench },
  { to: "/library/recommendations", label: "AI Recommendations", icon: Sparkles },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center gap-2 whitespace-nowrap px-1 py-3 text-sm font-medium transition-colors ${
    isActive ? "text-ink" : "text-ink-muted hover:text-ink-secondary"
  }`;

/** Shared premium sub-nav for the four Library sections. A sticky,
 * underline-indicator tab bar (not a dropdown) — reads as a section of the
 * product, not a menu you open and close. */
export default function LibraryLayout() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your exercises, favorites, custom movements, and AI-driven suggestions, all in one place.
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
