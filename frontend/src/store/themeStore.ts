import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyFaviconTheme } from "../lib/favicon";
import type { ThemeMode } from "../types/user";

export type { ThemeMode };
export type ResolvedTheme = "light" | "dark";
export type AccentColor = "violet" | "emerald";

const systemQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === "system") return systemQuery().matches ? "dark" : "light";
  return theme;
}

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  accentColor: AccentColor;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (accentColor: AccentColor) => void;
  applyToDocument: () => void;
}

// Persisted to localStorage (not just in-memory) so the last-picked accent
// survives logout/reload and can drive things like the login page's
// background before there's a session to read User.accent_color from. The
// server value still wins once /auth/refresh succeeds (see App.tsx), so a
// logged-in user's saved preference is always authoritative when present.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      resolvedTheme: "dark",
      accentColor: "violet",
      setTheme: (theme) => {
        set({ theme });
        get().applyToDocument();
      },
      setAccentColor: (accentColor) => {
        set({ accentColor });
        get().applyToDocument();
      },
      applyToDocument: () => {
        const { theme, accentColor } = get();
        const resolved = resolveTheme(theme);
        set({ resolvedTheme: resolved });
        document.documentElement.setAttribute("data-theme", resolved);
        document.documentElement.setAttribute("data-accent", accentColor);
        applyFaviconTheme(accentColor);
      },
    }),
    {
      name: "liftryt-theme",
      partialize: (state) => ({ theme: state.theme, accentColor: state.accentColor }),
    },
  ),
);

// The store is a module-level singleton that outlives the page, so this
// listener is attached exactly once at import time rather than from a
// component effect (there's no natural unmount to tear it down from — the
// only real-world "duplicate listener" case is Vite HMR during local dev,
// not production). Re-applies live if the OS preference changes while
// "system" is selected, so the app follows a live OS theme toggle without
// needing a reload.
if (typeof window !== "undefined") {
  systemQuery().addEventListener("change", () => {
    if (useThemeStore.getState().theme === "system") {
      useThemeStore.getState().applyToDocument();
    }
  });
}
