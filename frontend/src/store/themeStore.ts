import { create } from "zustand";

export type ThemeMode = "light" | "dark";
export type AccentColor = "violet" | "emerald";

interface ThemeState {
  theme: ThemeMode;
  accentColor: AccentColor;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (accentColor: AccentColor) => void;
  applyToDocument: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
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
  },
}));
