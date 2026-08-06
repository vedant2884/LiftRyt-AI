import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import { useAuthStore } from "./store/authStore";
import type { AuthResponse } from "./types/auth";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import ExercisesPage from "./pages/ExercisesPage";
import WeightPage from "./pages/WeightPage";
import WorkoutsPage from "./pages/WorkoutsPage";
import WorkoutDetailPage from "./pages/WorkoutDetailPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const finishBootstrap = useAuthStore((s) => s.finishBootstrap);

  useEffect(() => {
    // Silent refresh on load: the in-memory access token doesn't survive a
    // page reload, but the httpOnly refresh cookie does, so this recovers
    // the session without the user re-entering credentials.
    api
      .post<AuthResponse>("/auth/refresh")
      .then((res) => setAuth(res.data.access_token, res.data.user))
      .catch(() => {
        // No valid refresh cookie (never logged in, or it expired/was
        // revoked) — this is a normal, expected outcome, not an error.
      })
      .finally(finishBootstrap);
  }, [setAuth, finishBootstrap]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/weight" element={<WeightPage />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
