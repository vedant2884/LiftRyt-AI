export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface SplitToolResult {
  split_type: string;
  days: {
    day_number: number;
    label: string;
    exercises: { name: string; sets: number; reps: string; reason: string }[];
  }[];
}

export interface MacroToolResult {
  bmr: number;
  tdee: number;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
}

export interface ToolPayload {
  name: "generate_workout_split" | "calculate_macros" | string;
  arguments: Record<string, unknown>;
  result: SplitToolResult | MacroToolResult | { error: string };
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  tool_name: string | null;
  tool_payload: ToolPayload | null;
  created_at: string;
}
