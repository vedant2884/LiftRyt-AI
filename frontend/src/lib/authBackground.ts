import type { CSSProperties } from "react";
import { useThemeStore } from "../store/themeStore";
import type { AccentColor } from "../store/themeStore";

// public/ assets are served as-is from the root, in both dev and a
// production build (`vite build` copies public/* into dist/ unchanged), so
// these are plain absolute paths rather than bundler-resolved imports.
const AUTH_BACKGROUND_BY_ACCENT: Record<AccentColor, string> = {
  violet: "/assets/liftryt_auth_bg.svg",
  emerald: "/assets/liftryt_auth_bg_emerald.svg",
};

/** Background for the login/signup page wrapper, keyed off the same
 * themeStore.accentColor that already drives every accent-colored button
 * and link, so "Violet vs Emerald" has exactly one source of truth. */
export function useAuthBackgroundStyle(): CSSProperties {
  const accentColor = useThemeStore((s) => s.accentColor);
  return {
    backgroundColor: "#000",
    backgroundImage: `url(${AUTH_BACKGROUND_BY_ACCENT[accentColor]})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}
