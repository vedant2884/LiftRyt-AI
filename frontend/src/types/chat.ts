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
  session_id: string;
  role: ChatRole;
  content: string;
  tool_name: string | null;
  tool_payload: ToolPayload | null;
  created_at: string;
}

/** Both halves of a turn — the user's message needs its real persisted id
 * (not just the reply), or it can never later be the target of an edit. */
export interface SendMessageResult {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
}

/** Sent alongside a message from the exercise detail modal's "Ask Coach"
 * box so the coach knows which exercise is open without the user typing
 * its name. Mirrors app.schemas.chat.ExerciseChatContext. */
export interface ExerciseChatContext {
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string;
  category: string;
  difficulty: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}
