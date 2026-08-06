import { create } from "zustand";
import type { UserProfile } from "../types/user";

interface AuthState {
  // Deliberately not persisted (no localStorage) — kept in memory only, so
  // an XSS payload can't read it off disk. Survives page reloads instead
  // via the silent-refresh bootstrap in App.tsx, which trades on the
  // httpOnly refresh cookie the browser still has.
  accessToken: string | null;
  user: UserProfile | null;
  isBootstrapping: boolean;
  setAuth: (accessToken: string, user: UserProfile) => void;
  clearAuth: () => void;
  finishBootstrap: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isBootstrapping: true,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
  finishBootstrap: () => set({ isBootstrapping: false }),
}));
