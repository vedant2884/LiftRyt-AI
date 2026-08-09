import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon } from "lucide-react";
import { logout as logoutApi } from "../api/auth";
import { initials, resolveAvatarUrl } from "../lib/avatar";
import { useAuthStore } from "../store/authStore";

/** YouTube-style: a single circular avatar replaces the old name/Profile/
 * Log out row. Shared between the desktop header and the mobile header bar
 * (not duplicated inside the hamburger drawer) so there's exactly one place
 * this menu lives regardless of viewport. */
export default function AccountMenu() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const resolvedAvatarUrl = user ? resolveAvatarUrl(user) : null;
  const [avatarUrl, setAvatarUrl] = useState(resolvedAvatarUrl);
  const [avatarBroken, setAvatarBroken] = useState(false);
  if (avatarUrl !== resolvedAvatarUrl) {
    // A new upload or a refreshed Google picture — give the new URL a clean
    // attempt instead of carrying over the previous one's broken state.
    setAvatarUrl(resolvedAvatarUrl);
    setAvatarBroken(false);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  async function handleLogout() {
    setOpen(false);
    await logoutApi();
    clearAuth();
    navigate("/login");
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-line-strong transition hover:border-ink-muted active:scale-95 sm:h-9 sm:w-9"
      >
        {avatarUrl && !avatarBroken ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setAvatarBroken(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-accent/15 text-xs font-semibold text-accent">
            {initials(user.full_name)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-sm font-medium text-ink">{user.full_name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink-secondary transition hover:bg-surface-hover hover:text-ink"
            >
              <UserIcon size={15} strokeWidth={2} />
              Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-secondary transition hover:bg-surface-hover hover:text-ink"
            >
              <LogOut size={15} strokeWidth={2} />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
