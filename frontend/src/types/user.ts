export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
// vegan/pescatarian/keto/other are legacy values kept only so existing
// users' stored preference still type-checks — SignupPage/
// GoogleCompleteProfilePage only offer none/vegetarian/non_vegetarian/
// eggetarian now.
export type DietaryPreference =
  | "none"
  | "vegetarian"
  | "non_vegetarian"
  | "eggetarian"
  | "vegan"
  | "pescatarian"
  | "keto"
  | "other";
export type WeightUnit = "kg" | "lb";
export type LengthUnit = "cm" | "in";
export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "violet" | "emerald";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  google_avatar_url: string | null;
  has_password: boolean;
  has_completed_onboarding: boolean;
  // null only for accounts that predate date_of_birth (age still populated
  // for them via the backend's legacy_age fallback — see User.age).
  date_of_birth: string | null;
  age: number;
  sex: Sex;
  height_cm: number;
  goal_weight_kg: number | null;
  activity_level: ActivityLevel;
  training_experience: ExperienceLevel;
  dietary_preference: DietaryPreference;
  unit_weight: WeightUnit;
  unit_length: LengthUnit;
  theme: ThemeMode;
  accent_color: AccentColor;
  default_progression_increment_kg: number;
  workout_reminders_enabled: boolean;
  created_at: string;
}
