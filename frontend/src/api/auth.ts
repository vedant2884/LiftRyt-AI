import { api } from "../lib/api";
import type { AuthResponse } from "../types/auth";
import type { ActivityLevel, DietaryPreference, ExperienceLevel, Sex } from "../types/user";

export interface SignupPayload {
  email: string;
  password: string;
  full_name: string;
  age: number;
  sex: Sex;
  height_cm: number;
  goal_weight_kg?: number;
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
