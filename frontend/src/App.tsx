import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import { useAuthStore } from "./store/authStore";
import { useThemeStore } from "./store/themeStore";
import type { AuthResponse } from "./types/auth";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import GoogleCompleteProfilePage from "./pages/GoogleCompleteProfilePage";
import OnboardingPage from "./pages/OnboardingPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import WorkoutsPage from "./pages/WorkoutsPage";
import WorkoutAnalysisPage from "./pages/WorkoutAnalysisPage";
import ActiveWorkoutPage from "./pages/ActiveWorkoutPage";
import WorkoutDetailPage from "./pages/WorkoutDetailPage";
import ExerciseLibraryPage from "./pages/library/ExerciseLibraryPage";
import FavoriteExercisesPage from "./pages/library/FavoriteExercisesPage";
import CustomExercisesPage from "./pages/library/CustomExercisesPage";
import AiRecommendationsPage from "./pages/library/AiRecommendationsPage";
import WeightPage from "./pages/WeightPage";
import MacroCalculatorPage from "./pages/MacroCalculatorPage";
import SplitGeneratorPage from "./pages/SplitGeneratorPage";
import CoachPage from "./pages/CoachPage";
import ProfilePage from "./pages/ProfilePage";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import WorkoutsLayout from "./components/WorkoutsLayout";
import LibraryLayout from "./components/LibraryLayout";
import Toaster from "./components/Toaster";

function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const finishBootstrap = useAuthStore((s) => s.finishBootstrap);

  useEffect(() => {
    // Stamp the default theme/accent onto <html> immediately so the
    // data-theme/data-accent attributes exist from first paint, even
    // before we know whether there's a logged-in user to read a saved
    // preference from.
    useThemeStore.getState().applyToDocument();

    // Silent refresh on load: the in-memory access token doesn't survive a
    // page reload, but the httpOnly refresh cookie does, so this recovers
    // the session without the user re-entering credentials.
    api
      .post<AuthResponse>("/auth/refresh")
      .then((res) => {
        setAuth(res.data.access_token, res.data.user);
        useThemeStore.getState().setTheme(res.data.user.theme);
        useThemeStore.getState().setAccentColor(res.data.user.accent_color);
      })
      .catch(() => {
        // No valid refresh cookie (never logged in, or it expired/was
        // revoked) — this is a normal, expected outcome, not an error.
      })
      .finally(finishBootstrap);
  }, [setAuth, finishBootstrap]);

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/complete" element={<GoogleCompleteProfilePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/workouts" element={<WorkoutsLayout />}>
              <Route index element={<WorkoutsPage />} />
              <Route path="analysis" element={<WorkoutAnalysisPage />} />
            </Route>
            <Route path="/workouts/active" element={<ActiveWorkoutPage />} />
            <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
            <Route path="/weight" element={<WeightPage />} />
            <Route path="/library" element={<LibraryLayout />}>
              <Route index element={<ExerciseLibraryPage />} />
              <Route path="favorites" element={<FavoriteExercisesPage />} />
              <Route path="custom" element={<CustomExercisesPage />} />
              <Route path="recommendations" element={<AiRecommendationsPage />} />
            </Route>
            <Route path="/macros" element={<MacroCalculatorPage />} />
            <Route path="/splits" element={<SplitGeneratorPage />} />
            <Route path="/coach" element={<CoachPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
