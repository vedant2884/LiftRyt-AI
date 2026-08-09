import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyFaviconTheme } from "../lib/favicon";

export type ThemeMode = "light" | "dark";
export type AccentColor = "violet" | "emerald";

interface ThemeState {
  theme: ThemeMode;
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
        document.documentElement.setAttribute("data-theme", theme);
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
