export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type DietaryPreference = "none" | "vegetarian" | "vegan" | "pescatarian" | "keto" | "other";
export type WeightUnit = "kg" | "lb";
export type LengthUnit = "cm" | "in";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  age: number;
  sex: Sex;
  height_cm: number;
  goal_weight_kg: number | null;
  activity_level: ActivityLevel;
  training_experience: ExperienceLevel;
  dietary_preference: DietaryPreference;
  unit_weight: WeightUnit;
  unit_length: LengthUnit;
  theme: string;
  created_at: string;
}
