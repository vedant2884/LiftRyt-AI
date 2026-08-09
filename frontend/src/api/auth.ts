import { api } from "../lib/api";
import type { AuthResponse, GoogleAuthResponse } from "../types/auth";
import type {
  AccentColor,
  ActivityLevel,
  DietaryPreference,
  ExperienceLevel,
  LengthUnit,
  Sex,
  ThemeMode,
  UserProfile,
  WeightUnit,
} from "../types/user";

export interface ProfileUpdatePayload {
  full_name?: string;
  username?: string;
  avatar_url?: string;
  age?: number;
  sex?: Sex;
  height_cm?: number;
  goal_weight_kg?: number;
  activity_level?: ActivityLevel;
  training_experience?: ExperienceLevel;
  dietary_preference?: DietaryPreference;
  unit_weight?: WeightUnit;
  unit_length?: LengthUnit;
  theme?: ThemeMode;
  accent_color?: AccentColor;
}

export interface SignupPayload {
  email: string;
  password: string;
  full_name: string;
  username: string;
  age: number;
  sex: Sex;
  height_cm: number;
  goal_weight_kg: number;
  starting_weight_kg?: number;
  activity_level?: ActivityLevel;
  training_experience?: ExperienceLevel;
  dietary_preference?: DietaryPreference;
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/auth/signup", payload);
  return res.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/auth/login", { email, password });
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function googleAuth(idToken: string): Promise<GoogleAuthResponse> {
  const res = await api.post<GoogleAuthResponse>("/auth/google", { id_token: idToken });
  return res.data;
}

export interface GoogleCompleteProfilePayload {
  google_token: string;
  username: string;
  age: number;
  sex: Sex;
  height_cm: number;
  goal_weight_kg: number;
  starting_weight_kg?: number;
  activity_level?: ActivityLevel;
  training_experience?: ExperienceLevel;
  dietary_preference?: DietaryPreference;
}

export async function googleCompleteProfile(
  payload: GoogleCompleteProfilePayload,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/auth/google/complete", payload);
  return res.data;
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<UserProfile> {
  const res = await api.patch<UserProfile>("/auth/me", payload);
  return res.data;
}

/** Uploads through our own backend (not client-side Firebase Storage) so it
 * works for every account regardless of sign-in method — see
 * backend/app/api/routers/auth.py's upload_avatar for why. Returns the full,
 * already-updated profile (including the new avatar_url) in one round trip,
 * so the caller can drop it straight into authStore without a second fetch. */
export async function uploadAvatarFile(file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post<UserProfile>("/auth/me/avatar", formData, {
    // Clears the instance's default "application/json" so axios/the browser
    // can set "multipart/form-data; boundary=..." itself — a boundary the
    // backend's multipart parser requires and we can't compute by hand.
    headers: { "Content-Type": undefined },
  });
  return res.data;
}

export interface ForgotPasswordResult {
  detail: string;
  dev_reset_link: string | null;
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  const res = await api.post<ForgotPasswordResult>("/auth/forgot-password", { email });
  return res.data;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post("/auth/reset-password", { token, new_password: newPassword });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function deleteAccount(): Promise<void> {
  await api.delete("/auth/me");
}

export async function completeOnboarding(): Promise<UserProfile> {
  const res = await api.post<UserProfile>("/auth/me/complete-onboarding");
  return res.data;
}
