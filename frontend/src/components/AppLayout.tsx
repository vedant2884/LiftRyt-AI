import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { CalendarDays, LayoutDashboard, Library, Menu, MessageCircle, PieChart, Scale, X } from "lucide-react";
import AccountMenu from "./AccountMenu";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
    isActive ? "bg-surface-hover text-ink" : "text-ink-secondary hover:text-ink"
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
    isActive ? "bg-surface-hover text-ink" : "text-ink-secondary hover:text-ink"
  }`;

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/coach", label: "Coach", icon: MessageCircle },
  { to: "/weight", label: "Weight", icon: Scale },
  { to: "/library", label: "Library", icon: Library },
  { to: "/macros", label: "Macros", icon: PieChart },
  { to: "/splits", label: "Splits", icon: CalendarDays },
];

export default function AppLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-svh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-semibold tracking-tight" onClick={() => setMenuOpen(false)}>
              Lift<span className="text-accent">Ryt</span> AI
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink key={link.to} to={link.to} className={navLinkClass} end={link.end}>
                    <Icon size={15} strokeWidth={2} />
                    {link.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-line-strong transition hover:bg-surface-hover active:scale-[0.97] md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="md:hidden">
              <AccountMenu />
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav className="space-y-1 border-t border-line px-4 py-3 md:hidden">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={mobileNavLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={16} strokeWidth={2} />
                  {link.label}
                </NavLink>
              );
            })}
          </nav>
        )}
      </header>

      {/* Enter-only fade/slide, keyed by path so it re-triggers on every
          navigation. A true coordinated exit animation would need the
          top-level <Routes> to hold the outgoing location until it
          finishes, which isn't worth the plumbing for something this
          subtle — Outlet already swaps instantly, so this animates the
          incoming page in rather than animating the outgoing one out. */}
      <motion.div
        key={location.pathname}
        initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
